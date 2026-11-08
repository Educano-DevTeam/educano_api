import { Prisma } from "../../../generated/prisma/client.js";
import type { Request, Response } from "express";
import { unlink } from "node:fs/promises";

import {
    criarAulaSchema,
    atualizarAulaSchema,
    idAulaParamsSchema,
    listarAulasQuerySchema,
} from "../schemas/lessons.schema.js";

import {
    LessonsServiceError,
    criarAula,
    listarAulas,
    consultarAula,
    atualizarAula,
    excluirAula,
} from "../services/lessons.service.js";

import {
    registrarConclusaoMaterial,
} from "../../progress/services/progress.service.js";

import { prisma } from "../../../config/prisma.js";

async function removerTemporario(caminho?: string) {
    if (caminho) {
        await unlink(caminho).catch(() => undefined);
    }
}

function responderErro(res: Response, erro: unknown) {
    if (erro instanceof LessonsServiceError) {
        const status: Record<string, number> = {
            ID_INVALIDO: 400,
            ARQUIVO_OBRIGATORIO: 400,

            SEM_PERMISSAO: 403,
            SEM_ACESSO_CURSO: 403,

            MODULO_NAO_ENCONTRADO: 404,
            AULA_NAO_ENCONTRADA: 404,
            ARQUIVO_INDISPONIVEL: 404,

            ERRO_UPLOAD: 502,
            ERRO_EXCLUSAO_ARQUIVO: 502,
        };

        return res.status(status[erro.code] ?? 400).json({
            message: erro.message,
        });
    }

    if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === "P2025"
    ) {
        return res.status(404).json({
            message: "Registro não encontrado.",
        });
    }

    console.error("Erro no módulo de aulas:", erro);

    return res.status(500).json({
        message: "Não foi possível concluir a solicitação.",
    });
}

// -----------------------------------------------------
// CRIAR AULA
// -----------------------------------------------------

export async function criar(
    req: Request,
    res: Response,
) {
    const validacao = criarAulaSchema.safeParse(req.body);

    if (!validacao.success) {
        await removerTemporario(req.file?.path);

        return res.status(400).json({
            message: "Dados inválidos para criação da aula.",
            errors: validacao.error.issues,
        });
    }

    if (!req.file) {
        return res.status(400).json({
            message: "Envie o arquivo do material no campo 'arquivo'.",
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        const resultado = await criarAula(
            usuario.id,
            usuario.tipo,
            validacao.data,
            req.file,
        );

        return res.status(201).json({
            message: "Aula criada e material enviado com sucesso.",
            ...resultado,
        });
    } catch (erro) {
        await removerTemporario(req.file.path);

        return responderErro(res, erro);
    }
}

// -----------------------------------------------------
// LISTAR AULAS
// -----------------------------------------------------

export async function listar(
    req: Request,
    res: Response,
) {
    const validacao = listarAulasQuerySchema.safeParse(req.query);

    if (!validacao.success) {
        return res.status(400).json({
            message: "Identificador do módulo inválido.",
            errors: validacao.error.issues,
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        const aulas = await listarAulas(
            validacao.data.idModulo,
            usuario.id,
            usuario.tipo,
        );

        return res.status(200).json({
            message: "Aulas consultadas com sucesso.",
            dados: aulas,
        });
    } catch (erro) {
        return responderErro(res, erro);
    }
}

// -----------------------------------------------------
// CONSULTAR AULA
// -----------------------------------------------------

export async function consultar(
    req: Request<{ id: string }>,
    res: Response,
) {
    const validacao = idAulaParamsSchema.safeParse(req.params);

    if (!validacao.success) {
        return res.status(400).json({
            message: "Identificador da aula inválido.",
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        const aula = await consultarAula(
            validacao.data.id,
            usuario.id,
            usuario.tipo,
        );

        return res.status(200).json({
            message: "Aula consultada com sucesso.",
            aula,
        });
    } catch (erro) {
        return responderErro(res, erro);
    }
}

// -----------------------------------------------------
// ATUALIZAR AULA
// -----------------------------------------------------

export async function atualizar(
    req: Request<{ id: string }>,
    res: Response,
) {
    const params = idAulaParamsSchema.safeParse(req.params);
    const body = atualizarAulaSchema.safeParse(req.body);

    if (!params.success || !body.success) {
        return res.status(400).json({
            message: "Dados inválidos para atualização da aula.",
            errors: [
                ...(!params.success ? params.error.issues : []),
                ...(!body.success ? body.error.issues : []),
            ],
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        const aula = await atualizarAula(
            params.data.id,
            usuario.id,
            usuario.tipo,
            body.data,
        );

        return res.status(200).json({
            message: "Aula atualizada com sucesso.",
            aula,
        });
    } catch (erro) {
        return responderErro(res, erro);
    }
}

// -----------------------------------------------------
// EXCLUIR AULA
// -----------------------------------------------------

export async function excluir(
    req: Request<{ id: string }>,
    res: Response,
) {
    const validacao = idAulaParamsSchema.safeParse(req.params);

    if (!validacao.success) {
        return res.status(400).json({
            message: "Identificador da aula inválido.",
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        await excluirAula(
            validacao.data.id,
            usuario.id,
            usuario.tipo,
        );

        return res.status(200).json({
            message: "Aula e material excluídos com sucesso.",
        });
    } catch (erro) {
        return responderErro(res, erro);
    }
}

export async function concluirProgresso(
    req: Request<{ id: string }>,
    res: Response,
) {
    const validacao = idAulaParamsSchema.safeParse(req.params);

    if (!validacao.success) {
        return res.status(400).json({
            message: "Identificador da aula inválido.",
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        // Valida se o usuário possui acesso ao material.
        await consultarAula(
            validacao.data.id,
            usuario.id,
            usuario.tipo,
        );

        // Registra a conclusão e concede a recompensa,
        // independentemente do tipo de usuário.
        const resultado = await prisma.$transaction(async (tx) => {
            return registrarConclusaoMaterial(
                tx,
                usuario.id,
                validacao.data.id,
            );
        });

        return res.status(200).json({
            message: resultado.registrada
                ? "Material concluído! Recompensas adicionadas ao perfil."
                : "Este material já havia sido concluído.",
            concluida: true,
            recompensa: resultado.recompensa,
            boostAplicado: resultado.boostAplicado,
        });
    } catch (erro) {
        return responderErro(res, erro);
    }
}