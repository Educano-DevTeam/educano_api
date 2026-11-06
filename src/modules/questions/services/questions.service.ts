import { Prisma } from "../../../generated/prisma/client.js";

import { prisma } from "../../../config/prisma.js";

import type {
    CriarQuestaoInput,
    AtualizarQuestaoInput,
} from "../types/questions.types.js";

export class QuestionsServiceError extends Error {
    constructor(
        public readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = "QuestionsServiceError";
    }
}

function validarUuid(id: string) {
    if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
        throw new QuestionsServiceError(
            "ID_INVALIDO",
            "Identificador inválido.",
        );
    }
}

function verificarPermissaoCriacao(tipoUsuario: string) {
    if (
        tipoUsuario !== "PROFESSOR" &&
        tipoUsuario !== "PARCEIRO" &&
        tipoUsuario !== "ADMIN"
    ) {
        throw new QuestionsServiceError(
            "SEM_PERMISSAO",
            "Somente professores, parceiros e administradores podem cadastrar questões.",
        );
    }
}

async function verificarPermissaoQuestao(
    idQuestao: string,
    idUsuario: string,
    tipoUsuario: string,
) {
    const questao = await prisma.questao.findUnique({
        where: { id: idQuestao },

        select: {
            id: true,
            idResponsavel: true,
        },
    });

    if (!questao) {
        throw new QuestionsServiceError(
            "QUESTAO_NAO_ENCONTRADA",
            "Questão não encontrada.",
        );
    }

    // O responsável pode administrar a própria questão.
    // Professores e administradores também podem administrar questões.
    const permitido =
        questao.idResponsavel === idUsuario ||
        tipoUsuario === "PROFESSOR" ||
        tipoUsuario === "ADMIN";

    if (!permitido) {
        throw new QuestionsServiceError(
            "SEM_PERMISSAO",
            "Você não tem permissão para modificar esta questão.",
        );
    }

    return questao;
}

const selecaoQuestao = {
    id: true,
    titulo: true,
    enunciado: true,
    dificuldade: true,
    criadoEm: true,
    atualizadoEm: true,

    responsavel: {
        select: {
            id: true,
            nome: true,
        },
    },

    alternativas: {
        orderBy: {
            letra: "asc" as const,
        },

        select: {
            id: true,
            letra: true,
            texto: true,
            criadoEm: true,
        },
    },
} satisfies Prisma.QuestaoSelect;

// -----------------------------------------------------
// CRIAR QUESTÃO
// -----------------------------------------------------

export async function criarQuestao(
    idUsuario: string,
    tipoUsuario: string,
    dados: CriarQuestaoInput,
) {
    verificarPermissaoCriacao(tipoUsuario);

    const questao = await prisma.$transaction(async (tx) => {
        // 1. Cria a questão.
        const novaQuestao = await tx.questao.create({
            data: {
                titulo: dados.titulo?.trim() || null,
                enunciado: dados.enunciado,
                dificuldade: dados.dificuldade,
                idResponsavel: idUsuario,
            },

            select: {
                id: true,
            },
        });

        // 2. Cria suas alternativas.
        const alternativas = await Promise.all(
            dados.alternativas.map((alternativa) =>
                tx.alternativa.create({
                    data: {
                        idQuestao: novaQuestao.id,
                        idResponsavel: idUsuario,
                        letra: alternativa.letra,
                        texto: alternativa.texto,
                    },
                }),
            ),
        );

        // 3. Localiza a alternativa correta.
        const alternativaCorreta = alternativas.find(
            (alternativa) => alternativa.letra === dados.letraCorreta,
        );

        if (!alternativaCorreta) {
            throw new QuestionsServiceError(
                "ALTERNATIVA_CORRETA_INVALIDA",
                "Não foi possível identificar a alternativa correta.",
            );
        }

        // 4. Associa a alternativa correta à questão.
        await tx.questao.update({
            where: {
                id: novaQuestao.id,
            },

            data: {
                idAlternativaCorreta: alternativaCorreta.id,
            },
        });

        return tx.questao.findUniqueOrThrow({
            where: {
                id: novaQuestao.id,
            },

            select: selecaoQuestao,
        });
    });

    return questao;
}

// -----------------------------------------------------
// LISTAR QUESTÕES
// -----------------------------------------------------

export async function listarQuestoes(
    idUsuario: string,
    tipoUsuario: string,
    filtros: {
        dificuldade?: "FACIL" | "MEDIO" | "DIFICIL";
        busca?: string;
        pagina: number;
        limite: number;
    },
) {
    verificarPermissaoCriacao(tipoUsuario);

    const where: Prisma.QuestaoWhereInput = {
        ...(filtros.dificuldade && {
            dificuldade: filtros.dificuldade,
        }),

        ...(filtros.busca && {
            OR: [
                {
                    titulo: {
                        contains: filtros.busca,
                        mode: "insensitive",
                    },
                },
                {
                    enunciado: {
                        contains: filtros.busca,
                        mode: "insensitive",
                    },
                },
            ],
        }),

        // Parceiros visualizam apenas suas próprias questões.
        ...(tipoUsuario === "PARCEIRO" && {
            idResponsavel: idUsuario,
        }),
    };

    const [questoes, total] = await prisma.$transaction([
        prisma.questao.findMany({
            where,

            select: selecaoQuestao,

            orderBy: {
                criadoEm: "desc",
            },

            skip: (filtros.pagina - 1) * filtros.limite,

            take: filtros.limite,
        }),

        prisma.questao.count({
            where,
        }),
    ]);

    return {
        dados: questoes,

        paginacao: {
            pagina: filtros.pagina,
            limite: filtros.limite,
            total,
            totalPaginas: Math.ceil(total / filtros.limite),
        },
    };
}

// -----------------------------------------------------
// CONSULTAR QUESTÃO
// -----------------------------------------------------

export async function consultarQuestao(
    idQuestao: string,
    idUsuario: string,
    tipoUsuario: string,
) {
    validarUuid(idQuestao);

    const questao = await prisma.questao.findUnique({
        where: {
            id: idQuestao,
        },

        select: {
            ...selecaoQuestao,

            idResponsavel: true,

            alternativaCorreta: {
                select: {
                    letra: true,
                },
            },
        },
    });

    if (!questao) {
        throw new QuestionsServiceError(
            "QUESTAO_NAO_ENCONTRADA",
            "Questão não encontrada.",
        );
    }

    const permitido =
        questao.idResponsavel === idUsuario ||
        tipoUsuario === "PROFESSOR" ||
        tipoUsuario === "ADMIN";

    if (!permitido) {
        throw new QuestionsServiceError(
            "SEM_PERMISSAO",
            "Você não tem permissão para consultar esta questão.",
        );
    }

    return {
        ...questao,
        letraCorreta: questao.alternativaCorreta?.letra ?? null,
        alternativaCorreta: undefined,
    };
}

// -----------------------------------------------------
// ATUALIZAR QUESTÃO
// -----------------------------------------------------

export async function atualizarQuestao(
    idQuestao: string,
    idUsuario: string,
    tipoUsuario: string,
    dados: AtualizarQuestaoInput,
) {
    validarUuid(idQuestao);

    await verificarPermissaoQuestao(
        idQuestao,
        idUsuario,
        tipoUsuario,
    );

    const questao = await prisma.$transaction(async (tx) => {
        const dadosAtualizacao: Prisma.QuestaoUpdateInput = {};

        if (dados.titulo !== undefined) {
            dadosAtualizacao.titulo = dados.titulo?.trim() || null;
        }

        if (dados.enunciado !== undefined) {
            dadosAtualizacao.enunciado = dados.enunciado;
        }

        if (dados.dificuldade !== undefined) {
            dadosAtualizacao.dificuldade = dados.dificuldade;
        }

        if (dados.alternativas) {
            // Primeiro remove a referência à alternativa correta.
            await tx.questao.update({
                where: {
                    id: idQuestao,
                },

                data: {
                    alternativaCorreta: {
                        disconnect: true,
                    },
                },
            });

            // Substitui as alternativas anteriores.
            await tx.alternativa.deleteMany({
                where: {
                    idQuestao,
                },
            });

            const novasAlternativas = await Promise.all(
                dados.alternativas.map((alternativa) =>
                    tx.alternativa.create({
                        data: {
                            idQuestao,
                            idResponsavel: idUsuario,
                            letra: alternativa.letra,
                            texto: alternativa.texto,
                        },
                    }),
                ),
            );

            const correta = novasAlternativas.find(
                (alternativa) => alternativa.letra === dados.letraCorreta,
            );

            if (!correta) {
                throw new QuestionsServiceError(
                    "ALTERNATIVA_CORRETA_INVALIDA",
                    "Alternativa correta não encontrada.",
                );
            }

            dadosAtualizacao.alternativaCorreta = {
                connect: {
                    id: correta.id,
                },
            };
        } else if (dados.letraCorreta) {
            const alternativa = await tx.alternativa.findFirst({
                where: {
                    idQuestao,
                    letra: dados.letraCorreta,
                },
            });

            if (!alternativa) {
                throw new QuestionsServiceError(
                    "ALTERNATIVA_CORRETA_INVALIDA",
                    "A alternativa indicada não existe.",
                );
            }

            dadosAtualizacao.alternativaCorreta = {
                connect: {
                    id: alternativa.id,
                },
            };
        }

        await tx.questao.update({
            where: {
                id: idQuestao,
            },

            data: dadosAtualizacao,
        });

        return tx.questao.findUniqueOrThrow({
            where: {
                id: idQuestao,
            },

            select: selecaoQuestao,
        });
    });

    return questao;
}

// -----------------------------------------------------
// EXCLUIR QUESTÃO
// -----------------------------------------------------

export async function excluirQuestao(
    idQuestao: string,
    idUsuario: string,
    tipoUsuario: string,
) {
    validarUuid(idQuestao);

    await verificarPermissaoQuestao(
        idQuestao,
        idUsuario,
        tipoUsuario,
    );

    // Não permite remover questões que já foram utilizadas em testes
    // ou tentativas. Isso preserva o histórico dos alunos.
    const [associacoes, tentativas] = await Promise.all([
        prisma.testeQuestao.count({
            where: {
                idQuestao,
            },
        }),

        prisma.tentativaQuestao.count({
            where: {
                idQuestao,
            },
        }),
    ]);

    if (associacoes > 0 || tentativas > 0) {
        throw new QuestionsServiceError(
            "QUESTAO_EM_USO",
            "Esta questão já foi utilizada e não pode ser excluída.",
        );
    }

    await prisma.questao.delete({
        where: {
            id: idQuestao,
        },
    });
}