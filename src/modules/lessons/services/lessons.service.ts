import { Prisma } from "../../../generated/prisma/client.js";

import { prisma } from "../../../config/prisma.js";

import {
    enviarArquivo,
    consultarArquivo,
    excluirArquivo,
} from "../../files/services/files.service.js";

import type {
    CriarAulaInput,
    AtualizarAulaInput,
} from "../types/lessons.types.js";

export class LessonsServiceError extends Error {
    constructor(
        public readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = "LessonsServiceError";
    }
}

function validarUuid(id: string) {
    if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
        throw new LessonsServiceError(
            "ID_INVALIDO",
            "Identificador inválido.",
        );
    }
}

// Converte o tipo de material para o tipo utilizado na tabela Arquivo.
function obterTipoArquivo(tipo: CriarAulaInput["tipo"]) {
    switch (tipo) {
        case "VIDEO":
            return "VIDEO" as const;

        case "AUDIO":
            return "AUDIO" as const;

        case "PDF":
            return "PDF" as const;

        case "DOCUMENTO":
            return "DOCUMENTO" as const;

        default:
            return "OUTRO" as const;
    }
}

// Verifica se o usuário pode administrar o conteúdo do curso.
async function verificarPermissaoGerenciamento(
    idModulo: string,
    idUsuario: string,
    tipoUsuario: string,
) {
    const modulo = await prisma.modulo.findUnique({
        where: { id: idModulo },

        select: {
            id: true,

            sessao: {
                select: {
                    curso: {
                        select: {
                            idResponsavel: true,
                        },
                    },
                },
            },
        },
    });

    if (!modulo) {
        throw new LessonsServiceError(
            "MODULO_NAO_ENCONTRADO",
            "Módulo não encontrado.",
        );
    }

    const ehProfessor = tipoUsuario === "PROFESSOR";

    const ehParceiroResponsavel =
        tipoUsuario === "PARCEIRO" &&
        modulo.sessao.curso.idResponsavel === idUsuario;

    if (!ehProfessor && !ehParceiroResponsavel) {
        throw new LessonsServiceError(
            "SEM_PERMISSAO",
            "Somente professores ou o parceiro responsável pelo curso podem gerenciar suas aulas.",
        );
    }

    return modulo;
}

async function verificarPermissaoAula(
    idAula: string,
    idUsuario: string,
    tipoUsuario: string,
) {
    const aula = await prisma.aula.findUnique({
        where: { id: idAula },

        select: {
            id: true,
            idModulo: true,
            idArquivo: true,

            modulo: {
                select: {
                    sessao: {
                        select: {
                            curso: {
                                select: {
                                    idResponsavel: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!aula) {
        throw new LessonsServiceError(
            "AULA_NAO_ENCONTRADA",
            "Aula não encontrada.",
        );
    }

    const ehProfessor = tipoUsuario === "PROFESSOR";

    const ehParceiroResponsavel =
        tipoUsuario === "PARCEIRO" &&
        aula.modulo.sessao.curso.idResponsavel === idUsuario;

    if (!ehProfessor && !ehParceiroResponsavel) {
        throw new LessonsServiceError(
            "SEM_PERMISSAO",
            "Você não tem permissão para modificar esta aula.",
        );
    }

    return aula;
}

// -----------------------------------------------------
// CRIAR AULA
// -----------------------------------------------------

export async function criarAula(
    idUsuario: string,
    tipoUsuario: string,
    dados: CriarAulaInput,
    arquivo: Express.Multer.File,
) {
    validarUuid(dados.idModulo);

    if (!arquivo) {
        throw new LessonsServiceError(
            "ARQUIVO_OBRIGATORIO",
            "Envie o arquivo do material didático.",
        );
    }

    await verificarPermissaoGerenciamento(
        dados.idModulo,
        idUsuario,
        tipoUsuario,
    );

    // 1. Cria primeiro a aula, ainda sem arquivo associado.
    const aula = await prisma.aula.create({
        data: {
            idModulo: dados.idModulo,
            titulo: dados.titulo,
            descricao: dados.descricao?.trim() || null,

            tipo: dados.tipo,

            quantidadePaginas: dados.quantidadePaginas ?? null,
            duracaoMinutos: dados.duracaoMinutos ?? null,

            idResponsavel: idUsuario,
        },

        select: {
            id: true,
        },
    });

    let idArquivoEnviado: string | null = null;

    try {
        // 2. Envia o arquivo ao serviço existente.
        const resultado = await enviarArquivo({
            arquivo,
            idOrigem: idUsuario,
            tipo: obterTipoArquivo(dados.tipo),
            finalidade: "MATERIAL_AULA",
        });

        idArquivoEnviado = resultado.id;

        // 3. Associa o arquivo concluído à aula.
        const aulaAtualizada = await prisma.aula.update({
            where: {
                id: aula.id,
            },

            data: {
                idArquivo: resultado.id,
            },

            select: {
                id: true,
                idModulo: true,
                titulo: true,
                descricao: true,
                idArquivo: true,
                tipo: true,
                quantidadePaginas: true,
                duracaoMinutos: true,
                criadoEm: true,
            },
        });

        return {
            aula: aulaAtualizada,

            arquivo: {
                id: resultado.id,
                nomeOriginal: resultado.nomeOriginal,
                contentType: resultado.contentType,
                tamanhoBytes: resultado.tamanhoBytes,
                url: resultado.url,
            },
        };
    } catch (erro) {
        // Remove o arquivo do R2 e do banco, caso já tenha sido enviado.
        if (idArquivoEnviado) {
            await excluirArquivo(idArquivoEnviado).catch((erroArquivo) => {
                console.error(
                    "Falha ao remover arquivo após erro na criação da aula:",
                    erroArquivo,
                );
            });
        }

        // Remove a aula incompleta.
        await prisma.aula.delete({
            where: {
                id: aula.id,
            },
        }).catch((erroBanco) => {
            console.error(
                "Falha ao remover aula após erro no upload:",
                erroBanco,
            );
        });

        throw new LessonsServiceError(
            "ERRO_UPLOAD",
            "Não foi possível concluir o envio do material. A aula não foi cadastrada.",
        );
    }
}

// -----------------------------------------------------
// LISTAR AULAS DE UM MÓDULO
// -----------------------------------------------------

export async function listarAulas(
    idModulo: string,
    idUsuario: string,
    tipoUsuario: string,
) {
    validarUuid(idModulo);

    const modulo = await prisma.modulo.findUnique({
        where: { id: idModulo },

        select: {
            id: true,

            sessao: {
                select: {
                    curso: {
                        select: {
                            id: true,
                            idResponsavel: true,
                            status: true,
                        },
                    },
                },
            },
        },
    });

    if (!modulo) {
        throw new LessonsServiceError(
            "MODULO_NAO_ENCONTRADO",
            "Módulo não encontrado.",
        );
    }

    const curso = modulo.sessao.curso;

    const ehAdmin = tipoUsuario === "ADMIN";

    const ehProfessor = tipoUsuario === "PROFESSOR";

    const ehParceiroResponsavel =
        tipoUsuario === "PARCEIRO" &&
        curso.idResponsavel === idUsuario;

    // Professores e responsáveis podem visualizar seus conteúdos.
    // Os demais usuários precisam estar inscritos no curso.
    if (!ehAdmin && !ehProfessor && !ehParceiroResponsavel) {
        const inscricao = await prisma.inscricao.findUnique({
            where: {
                idUsuario_idCurso: {
                    idUsuario,
                    idCurso: curso.id,
                },
            },

            select: {
                id: true,
            },
        });

        if (!inscricao || curso.status !== "ATIVO") {
            throw new LessonsServiceError(
                "SEM_ACESSO_CURSO",
                "Você precisa estar inscrito em um curso ativo para acessar seus materiais.",
            );
        }
    }

    // Retorna somente os dados essenciais para o frontend.
    return prisma.aula.findMany({
        where: {
            idModulo,
        },

        orderBy: {
            criadoEm: "asc",
        },

        select: {
            id: true,
            idModulo: true,
            titulo: true,
            descricao: true,
            idArquivo: true,
        },
    });
}

// -----------------------------------------------------
// CONSULTAR AULA E ARQUIVO
// -----------------------------------------------------

export async function consultarAula(
    id: string,
    idUsuario: string,
    tipoUsuario: string,
) {
    validarUuid(id);

    const aula = await prisma.aula.findUnique({
        where: { id },

        select: {
            id: true,
            idModulo: true,
            titulo: true,
            descricao: true,
            idArquivo: true,
            tipo: true,
            quantidadePaginas: true,
            duracaoMinutos: true,
            criadoEm: true,

            modulo: {
                select: {
                    sessao: {
                        select: {
                            curso: {
                                select: {
                                    id: true,
                                    idResponsavel: true,
                                    status: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!aula) {
        throw new LessonsServiceError(
            "AULA_NAO_ENCONTRADA",
            "Aula não encontrada.",
        );
    }

    const curso = aula.modulo.sessao.curso;

    const ehAdmin = tipoUsuario === "ADMIN";

    const ehProfessor = tipoUsuario === "PROFESSOR";

    const ehParceiroResponsavel =
        tipoUsuario === "PARCEIRO" &&
        curso.idResponsavel === idUsuario;

    if (!ehAdmin && !ehProfessor && !ehParceiroResponsavel) {
        const inscricao = await prisma.inscricao.findUnique({
            where: {
                idUsuario_idCurso: {
                    idUsuario,
                    idCurso: curso.id,
                },
            },

            select: {
                id: true,
            },
        });

        if (!inscricao || curso.status !== "ATIVO") {
            throw new LessonsServiceError(
                "SEM_ACESSO_CURSO",
                "Você não tem permissão para acessar este material.",
            );
        }
    }

    // Gera a URL somente quando o material é efetivamente consultado.
    const arquivo = aula.idArquivo
        ? await consultarArquivo(aula.idArquivo)
        : null;

    if (aula.idArquivo && !arquivo) {
        throw new LessonsServiceError(
            "ARQUIVO_INDISPONIVEL",
            "O arquivo deste material não está disponível.",
        );
    }

    const {
        modulo: _modulo,
        ...dadosAula
    } = aula;

    return {
        ...dadosAula,

        arquivo: arquivo
            ? {
                id: arquivo.id,
                nomeOriginal: arquivo.nomeOriginal,
                tipo: arquivo.tipo,
                contentType: arquivo.contentType,
                tamanhoBytes: arquivo.tamanhoBytes,
                url: arquivo.url,
            }
            : null,
    };
}

// -----------------------------------------------------
// ATUALIZAR AULA
// -----------------------------------------------------

export async function atualizarAula(
    id: string,
    idUsuario: string,
    tipoUsuario: string,
    dados: AtualizarAulaInput,
) {
    validarUuid(id);

    await verificarPermissaoAula(
        id,
        idUsuario,
        tipoUsuario,
    );

    return prisma.aula.update({
        where: { id },

        data: {
            ...(dados.titulo !== undefined && {
                titulo: dados.titulo,
            }),

            ...(dados.descricao !== undefined && {
                descricao: dados.descricao?.trim() || null,
            }),
        },

        select: {
            id: true,
            idModulo: true,
            titulo: true,
            descricao: true,
            idArquivo: true,
            tipo: true,
            quantidadePaginas: true,
            duracaoMinutos: true,
            criadoEm: true,
            atualizadoEm: true,
        },
    });
}

// -----------------------------------------------------
// EXCLUIR AULA
// -----------------------------------------------------

export async function excluirAula(
    id: string,
    idUsuario: string,
    tipoUsuario: string,
) {
    validarUuid(id);

    const aula = await verificarPermissaoAula(
        id,
        idUsuario,
        tipoUsuario,
    );

    // Exclui o arquivo do R2 e do banco antes da aula.
    if (aula.idArquivo) {
        try {
            await excluirArquivo(aula.idArquivo);
        } catch (erro) {
            console.error("Erro ao excluir arquivo da aula:", erro);

            throw new LessonsServiceError(
                "ERRO_EXCLUSAO_ARQUIVO",
                "Não foi possível excluir o arquivo associado à aula.",
            );
        }
    }

    await prisma.aula.delete({
        where: { id },
    });

    return {
        id,
    };
}