import { Prisma } from "../../../generated/prisma/client.js";

import { prisma } from "../../../config/prisma.js";

import type {
    CriarAtividadeInput,
    CriarSimuladoInput,
    AtualizarTesteInput,
    ListarTestesInput,
} from "../types/tests.types.js";

export class TestsServiceError extends Error {
    constructor(
        public readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = "TestsServiceError";
    }
}

function validarUuid(id: string) {
    if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
        throw new TestsServiceError(
            "ID_INVALIDO",
            "Identificador inválido.",
        );
    }
}

// -----------------------------------------------------
// PERMISSÕES DE GERENCIAMENTO
// -----------------------------------------------------

async function verificarPermissaoModulo(
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
                        },
                    },
                },
            },
        },
    });

    if (!modulo) {
        throw new TestsServiceError(
            "MODULO_NAO_ENCONTRADO",
            "Módulo não encontrado.",
        );
    }

    const permitido =
        tipoUsuario === "ADMIN" ||
        tipoUsuario === "PROFESSOR" ||
        (
            tipoUsuario === "PARCEIRO" &&
            modulo.sessao.curso.idResponsavel === idUsuario
        );

    if (!permitido) {
        throw new TestsServiceError(
            "SEM_PERMISSAO",
            "Somente professores, administradores ou o parceiro responsável pelo curso podem gerenciar atividades deste módulo.",
        );
    }

    return modulo;
}

// -----------------------------------------------------
// VALIDAR QUESTÕES SELECIONADAS
// -----------------------------------------------------

async function validarQuestoesSelecionadas(
    questaoIds: string[],
    idUsuario: string,
    tipoUsuario: string,
) {
    const questoes = await prisma.questao.findMany({
        where: {
            id: {
                in: questaoIds,
            },
        },

        select: {
            id: true,
        },
    });

    if (questoes.length !== questaoIds.length) {
        throw new TestsServiceError(
            "QUESTOES_INVALIDAS",
            "Uma ou mais questões não existem ou você não tem permissão para utilizá-las.",
        );
    }
}

// -----------------------------------------------------
// CRIAR ATIVIDADE
// -----------------------------------------------------

export async function criarAtividade(
    idUsuario: string,
    tipoUsuario: string,
    dados: CriarAtividadeInput,
) {
    await verificarPermissaoModulo(
        dados.idModulo,
        idUsuario,
        tipoUsuario,
    );

    await validarQuestoesSelecionadas(
        dados.questaoIds,
        idUsuario,
        tipoUsuario,
    );

    return prisma.$transaction(async (tx) => {
        const teste = await tx.teste.create({
            data: {
                idModulo: dados.idModulo,
                idResponsavel: idUsuario,
                tipo: "ATIVIDADE",
                tema: dados.tema?.trim() || null,
                tempoMinutos: dados.tempoMinutos,
                quantidadeQuestoes: dados.questaoIds.length,
            },

            select: {
                id: true,
                idModulo: true,
                idResponsavel: true,
                tipo: true,
                tema: true,
                tempoMinutos: true,
                quantidadeQuestoes: true,
                criadoEm: true,
            },
        });

        await tx.testeQuestao.createMany({
            data: dados.questaoIds.map((idQuestao, index) => ({
                idTeste: teste.id,
                idQuestao,
                idResponsavel: idUsuario,
                ordem: index + 1,
            })),
        });

        return {
            ...teste,

            questoes: await tx.testeQuestao.findMany({
                where: {
                    idTeste: teste.id,
                },

                orderBy: {
                    ordem: "asc",
                },

                select: {
                    idQuestao: true,
                    ordem: true,

                    questao: {
                        select: {
                            id: true,
                            titulo: true,
                            enunciado: true,
                            dificuldade: true,

                            alternativas: {
                                orderBy: {
                                    letra: "asc",
                                },

                                select: {
                                    id: true,
                                    letra: true,
                                    texto: true,
                                },
                            },
                        },
                    },
                },
            }),
        };
    });
}

// -----------------------------------------------------
// CRIAR SIMULADO
// -----------------------------------------------------

export async function criarSimulado(
    idUsuario: string,
    tipoUsuario: string,
    dados: CriarSimuladoInput,
) {
    // Todos os tipos de usuário autenticados podem
    // criar simulados personalizados.

    // Verifica se existe quantidade suficiente de questões
    // com a dificuldade solicitada.
    const quantidadeDisponivel = await prisma.questao.count({
        where: {
            dificuldade: dados.dificuldade,
        },
    });

    if (quantidadeDisponivel < dados.quantidadeQuestoes) {
        throw new TestsServiceError(
            "QUESTOES_INSUFICIENTES",
            `Existem apenas ${quantidadeDisponivel} questões disponíveis com essa dificuldade.`,
        );
    }

    // Neste momento criamos somente a configuração.
    // O sorteio efetivo será feito ao iniciar a tentativa.
    return prisma.teste.create({
        data: {
            idModulo: null,
            idResponsavel: idUsuario,
            tipo: "SIMULADO",
            tema: dados.tema?.trim() || null,
            tempoMinutos: dados.tempoMinutos,
            dificuldade: dados.dificuldade,
            quantidadeQuestoes: dados.quantidadeQuestoes,
        },

        select: {
            id: true,
            idModulo: true,
            idResponsavel: true,
            tipo: true,
            tema: true,
            tempoMinutos: true,
            dificuldade: true,
            quantidadeQuestoes: true,
            criadoEm: true,
        },
    });
}

// -----------------------------------------------------
// FILTROS DE ACESSO À LISTAGEM
// -----------------------------------------------------

function montarFiltroAcesso(
    idUsuario: string,
    tipoUsuario: string,
): Prisma.TesteWhereInput {
    if (tipoUsuario === "ADMIN") {
        return {};
    }

    if (tipoUsuario === "PROFESSOR") {
        return {
            OR: [
                { tipo: "ATIVIDADE" },
                {
                    tipo: "SIMULADO",
                    idResponsavel: idUsuario,
                },
            ],
        };
    }

    if (tipoUsuario === "PARCEIRO") {
        return {
            OR: [
                {
                    tipo: "ATIVIDADE",
                    modulo: {
                        sessao: {
                            curso: {
                                idResponsavel: idUsuario,
                            },
                        },
                    },
                },
                {
                    tipo: "SIMULADO",
                    idResponsavel: idUsuario,
                },
            ],
        };
    }

    // Alunos visualizam seus simulados e atividades
    // dos cursos ativos nos quais estão inscritos.
    return {
        OR: [
            {
                tipo: "SIMULADO",
                idResponsavel: idUsuario,
            },
            {
                tipo: "ATIVIDADE",
                modulo: {
                    sessao: {
                        curso: {
                            status: "ATIVO",
                            inscricoes: {
                                some: {
                                    idUsuario,
                                },
                            },
                        },
                    },
                },
            },
        ],
    };
}

// -----------------------------------------------------
// LISTAR ATIVIDADES E SIMULADOS
// -----------------------------------------------------

export async function listarTestes(
    idUsuario: string,
    tipoUsuario: string,
    filtros: ListarTestesInput,
) {
    const where: Prisma.TesteWhereInput = {
        AND: [
            montarFiltroAcesso(idUsuario, tipoUsuario),

            ...(filtros.tipo
                ? [{ tipo: filtros.tipo }]
                : []),

            ...(filtros.idModulo
                ? [{ idModulo: filtros.idModulo }]
                : []),
        ],
    };

    const [testes, total] = await prisma.$transaction([
        prisma.teste.findMany({
            where,

            orderBy: {
                criadoEm: "desc",
            },

            skip: (filtros.pagina - 1) * filtros.limite,
            take: filtros.limite,

            select: {
                id: true,
                idModulo: true,
                idResponsavel: true,
                tipo: true,
                tema: true,
                tempoMinutos: true,
                dificuldade: true,
                quantidadeQuestoes: true,
                criadoEm: true,

                _count: {
                    select: {
                        tentativas: true,
                    },
                },

                modulo: {
                    select: {
                        id: true,
                        titulo: true,
                    },
                },
            },
        }),

        prisma.teste.count({ where }),
    ]);

    return {
        dados: testes,

        paginacao: {
            pagina: filtros.pagina,
            limite: filtros.limite,
            total,
            totalPaginas: Math.ceil(total / filtros.limite),
        },
    };
}

// -----------------------------------------------------
// CONSULTAR TESTE
// -----------------------------------------------------

export async function consultarTeste(
    id: string,
    idUsuario: string,
    tipoUsuario: string,
) {
    validarUuid(id);

    const teste = await prisma.teste.findUnique({
        where: { id },

        select: {
            id: true,
            idModulo: true,
            idResponsavel: true,
            tipo: true,
            tema: true,
            tempoMinutos: true,
            dificuldade: true,
            quantidadeQuestoes: true,
            criadoEm: true,
            atualizadoEm: true,

            modulo: {
                select: {
                    id: true,
                    titulo: true,

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

            questoes: {
                orderBy: {
                    ordem: "asc",
                },

                select: {
                    idQuestao: true,
                    ordem: true,

                    questao: {
                        select: {
                            id: true,
                            titulo: true,
                            enunciado: true,
                            dificuldade: true,

                            alternativas: {
                                orderBy: {
                                    letra: "asc",
                                },

                                select: {
                                    id: true,
                                    letra: true,
                                    texto: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!teste) {
        throw new TestsServiceError(
            "TESTE_NAO_ENCONTRADO",
            "Atividade ou simulado não encontrado.",
        );
    }

    if (teste.tipo === "SIMULADO") {
        const permitido =
            tipoUsuario === "ADMIN" ||
            teste.idResponsavel === idUsuario;

        if (!permitido) {
            throw new TestsServiceError(
                "SEM_PERMISSAO",
                "Você não tem permissão para consultar este simulado.",
            );
        }

        return teste;
    }

    const curso = teste.modulo?.sessao.curso;

    if (!curso) {
        throw new TestsServiceError(
            "MODULO_NAO_ENCONTRADO",
            "O módulo desta atividade não está disponível.",
        );
    }

    const podeGerenciar =
        tipoUsuario === "ADMIN" ||
        tipoUsuario === "PROFESSOR" ||
        (
            tipoUsuario === "PARCEIRO" &&
            curso.idResponsavel === idUsuario
        );

    if (!podeGerenciar) {
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
            throw new TestsServiceError(
                "SEM_ACESSO_CURSO",
                "Você precisa estar inscrito em um curso ativo para acessar esta atividade.",
            );
        }
    }

    return teste;
}

// -----------------------------------------------------
// ATUALIZAR TESTE
// -----------------------------------------------------

export async function atualizarTeste(
    id: string,
    idUsuario: string,
    tipoUsuario: string,
    dados: AtualizarTesteInput,
) {
    validarUuid(id);

    const teste = await prisma.teste.findUnique({
        where: { id },

        select: {
            id: true,
            idResponsavel: true,
            tipo: true,
            idModulo: true,
            dificuldade: true,

            _count: {
                select: {
                    tentativas: true,
                },
            },
        },
    });

    if (!teste) {
        throw new TestsServiceError(
            "TESTE_NAO_ENCONTRADO",
            "Atividade ou simulado não encontrado.",
        );
    }

    if (teste._count.tentativas > 0) {
        throw new TestsServiceError(
            "TESTE_EM_USO",
            "Este teste já possui tentativas e não pode ser alterado.",
        );
    }

    if (teste.tipo === "ATIVIDADE") {
        if (!teste.idModulo) {
            throw new TestsServiceError(
                "MODULO_NAO_ENCONTRADO",
                "O módulo desta atividade não está disponível.",
            );
        }

        await verificarPermissaoModulo(
            teste.idModulo,
            idUsuario,
            tipoUsuario,
        );

        if (
            dados.dificuldade !== undefined ||
            dados.quantidadeQuestoes !== undefined
        ) {
            throw new TestsServiceError(
                "CAMPOS_INVALIDOS",
                "Dificuldade e quantidade são configuradas somente em simulados.",
            );
        }

        if (dados.questaoIds) {
            await validarQuestoesSelecionadas(
                dados.questaoIds,
                idUsuario,
                tipoUsuario,
            );
        }
    } else {
        const permitido =
            tipoUsuario === "ADMIN" ||
            teste.idResponsavel === idUsuario;

        if (!permitido) {
            throw new TestsServiceError(
                "SEM_PERMISSAO",
                "Você não tem permissão para modificar este simulado.",
            );
        }

        if (dados.questaoIds) {
            throw new TestsServiceError(
                "CAMPOS_INVALIDOS",
                "Simulados utilizam questões sorteadas automaticamente.",
            );
        }

        const dificuldade = dados.dificuldade;
        const quantidade = dados.quantidadeQuestoes;

        if (dificuldade || quantidade) {
            const quantidadeDisponivel = await prisma.questao.count({
                where: {
                    dificuldade: dificuldade ?? undefined,
                },
            });

            const quantidadeSolicitada = quantidade ?? (
                await prisma.teste.findUniqueOrThrow({
                    where: { id },
                    select: { quantidadeQuestoes: true },
                })
            ).quantidadeQuestoes;

            if (quantidadeDisponivel < quantidadeSolicitada) {
                throw new TestsServiceError(
                    "QUESTOES_INSUFICIENTES",
                    `Existem apenas ${quantidadeDisponivel} questões disponíveis para essa configuração.`,
                );
            }
        }
    }

    return prisma.$transaction(async (tx) => {
        if (
            teste.tipo === "ATIVIDADE" &&
            dados.questaoIds
        ) {
            await tx.testeQuestao.deleteMany({
                where: {
                    idTeste: id,
                },
            });

            await tx.testeQuestao.createMany({
                data: dados.questaoIds.map((idQuestao, index) => ({
                    idTeste: id,
                    idQuestao,
                    idResponsavel: idUsuario,
                    ordem: index + 1,
                })),
            });
        }

        return tx.teste.update({
            where: { id },

            data: {
                ...(dados.tema !== undefined && {
                    tema: dados.tema?.trim() || null,
                }),

                ...(dados.tempoMinutos !== undefined && {
                    tempoMinutos: dados.tempoMinutos,
                }),

                ...(dados.questaoIds && {
                    quantidadeQuestoes: dados.questaoIds.length,
                }),

                ...(dados.dificuldade !== undefined && {
                    dificuldade: dados.dificuldade,
                }),

                ...(dados.quantidadeQuestoes !== undefined && {
                    quantidadeQuestoes: dados.quantidadeQuestoes,
                }),
            },

            select: {
                id: true,
                idModulo: true,
                idResponsavel: true,
                tipo: true,
                tema: true,
                tempoMinutos: true,
                dificuldade: true,
                quantidadeQuestoes: true,
                atualizadoEm: true,
            },
        });
    });
}

// -----------------------------------------------------
// EXCLUIR TESTE
// -----------------------------------------------------

export async function excluirTeste(
    id: string,
    idUsuario: string,
    tipoUsuario: string,
) {
    validarUuid(id);

    const teste = await prisma.teste.findUnique({
        where: { id },

        select: {
            id: true,
            idResponsavel: true,
            tipo: true,
            idModulo: true,

            _count: {
                select: {
                    tentativas: true,
                },
            },
        },
    });

    if (!teste) {
        throw new TestsServiceError(
            "TESTE_NAO_ENCONTRADO",
            "Atividade ou simulado não encontrado.",
        );
    }

    if (teste.tipo === "ATIVIDADE") {
        if (!teste.idModulo) {
            throw new TestsServiceError(
                "MODULO_NAO_ENCONTRADO",
                "O módulo desta atividade não está disponível.",
            );
        }

        await verificarPermissaoModulo(
            teste.idModulo,
            idUsuario,
            tipoUsuario,
        );
    } else {
        const permitido =
            tipoUsuario === "ADMIN" ||
            teste.idResponsavel === idUsuario;

        if (!permitido) {
            throw new TestsServiceError(
                "SEM_PERMISSAO",
                "Você não tem permissão para excluir este simulado.",
            );
        }
    }

    if (teste._count.tentativas > 0) {
        throw new TestsServiceError(
            "TESTE_EM_USO",
            "Este teste já possui tentativas registradas e não pode ser excluído.",
        );
    }

    await prisma.teste.delete({
        where: { id },
    });

    return { id };
}