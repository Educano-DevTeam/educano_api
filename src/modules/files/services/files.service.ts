
import { randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { unlink } from "node:fs/promises";

import {
    DeleteObjectCommand,
    GetObjectCommand,
    PutObjectCommand,
} from "@aws-sdk/client-s3";

import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { prisma } from "../../../config/prisma.js";
import { R2_BUCKET, r2Client } from "../../../config/storage.js";

import { fileTypeFromFile } from "file-type";
import path from "node:path";

import {
    FinalidadeArquivo,
    TipoArquivo,
} from "../../../generated/prisma/client.js";

interface EnviarArquivoInput {
    arquivo: Express.Multer.File;
    idOrigem: string;
    tipo: TipoArquivo;
    finalidade: FinalidadeArquivo;
}

function obterPasta(finalidade: FinalidadeArquivo, tipo: TipoArquivo) {
    switch (finalidade) {
        case "FOTO_PERFIL":
            return "usuarios/fotos-perfil";

        case "BACKGROUND_PERFIL":
            return "usuarios/backgrounds";

        case "CAPA_CURSO":
            return "cursos/capas";

        case "MATERIAL_CURSO":
        case "MATERIAL_AULA":
            return `materiais/${tipo.toLowerCase()}`;

        default:
            return "outros";
    }
}

function sanitizarNome(nome: string) {
    return nome
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .slice(-150);
}

async function validarArquivoReal(arquivo: Express.Multer.File) {
    const extensao = path.extname(arquivo.originalname).toLowerCase();

    const tipoDetectado = await fileTypeFromFile(arquivo.path);

    if (!tipoDetectado) {
        throw new Error("Não foi possível identificar o formato real do arquivo.");
    }

    const formatosValidos: Record<string, string[]> = {
        ".jpg": ["image/jpeg"],
        ".jpeg": ["image/jpeg"],
        ".png": ["image/png"],
        ".webp": ["image/webp"],
        ".mp3": ["audio/mpeg"],
        ".wav": ["audio/wav", "audio/x-wav", "audio/vnd.wave"],
        ".ogg": ["audio/ogg"],
        ".m4a": ["audio/mp4"],
        ".aac": ["audio/aac"],
        ".mp4": ["video/mp4"],
        ".webm": ["video/webm"],
        ".mov": ["video/quicktime"],
        ".pdf": ["application/pdf"],
    };

    const mimesValidos = formatosValidos[extensao];

    if (!mimesValidos || !mimesValidos.includes(tipoDetectado.mime)) {
        throw new Error("O conteúdo do arquivo não corresponde ao formato informado.");
    }

    return tipoDetectado;
}

function gerarChaveObjeto(
    idOrigem: string,
    finalidade: FinalidadeArquivo,
    tipo: TipoArquivo,
    nomeOriginal: string,
) {
    const pasta = obterPasta(finalidade, tipo);
    const nomeSeguro = sanitizarNome(nomeOriginal);

    return `educano/${pasta}/${idOrigem}/${randomUUID()}-${nomeSeguro}`;
}

async function gerarUrlAssinada(chaveObjeto: string) {
    return getSignedUrl(
        r2Client,
        new GetObjectCommand({
            Bucket: R2_BUCKET,
            Key: chaveObjeto,
        }),
        {
            expiresIn: 60 * 15,
        },
    );
}

export async function enviarArquivo({
    arquivo,
    idOrigem,
    tipo,
    finalidade,
}: EnviarArquivoInput) {
    const chaveObjeto = gerarChaveObjeto(
        idOrigem,
        finalidade,
        tipo,
        arquivo.originalname,
    );

    let objetoEnviado = false;

    try {
        await validarArquivoReal(arquivo);

        // 1. Cria o registro antes de enviar ao R2.
        const registro = await prisma.arquivo.create({
            data: {
                idOrigem,
                tipo,
                finalidade,
                nomeOriginal: arquivo.originalname,
                chaveObjeto,
                bucket: R2_BUCKET,
                contentType: arquivo.mimetype,
                tamanhoBytes: BigInt(arquivo.size),
                status: "PENDENTE",
            },
        });

        try {
            // 2. Envia o arquivo ao Cloudflare R2.
            const resultado = await r2Client.send(
                new PutObjectCommand({
                    Bucket: R2_BUCKET,
                    Key: chaveObjeto,
                    Body: createReadStream(arquivo.path),
                    ContentType: arquivo.mimetype,
                    ContentLength: arquivo.size,
                }),
            );

            objetoEnviado = true;

            // 3. Atualiza o registro após o envio bem-sucedido.
            const arquivoAtualizado = await prisma.arquivo.update({
                where: {
                    id: registro.id,
                },
                data: {
                    etag: resultado.ETag ?? null,
                    status: "CONCLUIDO",
                },
            });

            // 4. Gera uma URL temporária para acesso.
            const url = await gerarUrlAssinada(chaveObjeto);

            return {
                ...arquivoAtualizado,
                tamanhoBytes: arquivoAtualizado.tamanhoBytes.toString(),
                url,
            };
        } catch (erro) {
            // Tenta remover o objeto do R2, caso tenha sido enviado.
            if (objetoEnviado) {
                try {
                    await r2Client.send(
                        new DeleteObjectCommand({
                            Bucket: R2_BUCKET,
                            Key: chaveObjeto,
                        }),
                    );
                } catch (erroR2) {
                    console.error(
                        "Falha ao remover objeto incompleto do R2:",
                        erroR2,
                    );
                }
            }

            // Tenta remover o registro do banco.
            try {
                await prisma.arquivo.delete({
                    where: {
                        id: registro.id,
                    },
                });
            } catch (erroBanco) {
                console.error(
                    "Falha ao remover registro incompleto do arquivo:",
                    erroBanco,
                );
            }

            throw erro;
        }
    } finally {
        // Remove o arquivo temporário da API.
        await unlink(arquivo.path).catch(() => undefined);
    }
}

export async function consultarArquivo(id: string) {
    const arquivo = await prisma.arquivo.findUnique({
        where: { id },
    });

    if (!arquivo || arquivo.status !== "CONCLUIDO") {
        return null;
    }

    const url = await gerarUrlAssinada(arquivo.chaveObjeto);

    return {
        ...arquivo,
        tamanhoBytes: arquivo.tamanhoBytes.toString(),
        url,
    };
}

export async function excluirArquivo(id: string) {
    const arquivo = await prisma.arquivo.findUnique({
        where: { id },
    });

    if (!arquivo) {
        return null;
    }

    if (arquivo.status === "CONCLUIDO") {
        await r2Client.send(
            new DeleteObjectCommand({
                Bucket: arquivo.bucket,
                Key: arquivo.chaveObjeto,
            }),
        );
    }

    await prisma.arquivo.delete({
        where: { id },
    });

    return { id: arquivo.id };
}
