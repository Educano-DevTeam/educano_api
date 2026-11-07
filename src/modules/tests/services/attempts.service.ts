
import { prisma } from "../../../config/prisma.js";

export class AttemptsServiceError extends Error {
    constructor(
        public readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = "AttemptsServiceError";
    }
}

// Embaralha as questões para o sorteio dos simulados.
function embaralhar<T>(lista: T[]): T[] {
    const resultado = [...lista];

    for (let i = resultado.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));

        [resultado[i], resultado[j]] = [
            resultado[j],
            resultado[i],
        ];
    }

    return resultado;
}

// -----------------------------------------------------
// INICIAR TENTATIVA
// -----------------------------------------------------

export async function iniciarTentativa(
    idTeste: string,
    idUsuario: string,
) {
    const teste = await prisma.teste.findUnique({
        where: { id: idTeste },

        include: {
            questoes: {
                orderBy: {
                    ordem: "asc",
                },
                select: {
                    idQuestao: true,
                },
            },

            modulo: {
                select: {
                    sessao: {
                        select: {
                            curso: {
                                select: {
                                    id: true,
                                    status: true,
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!teste) {
        throw new AttemptsServiceError(
            "TESTE_NAO_ENCONTRADO",
            "Atividade ou simulado não encontrado.",
        );
    }

    // -------------------------------------------------
    // VALIDAR ACESSO
    // -------------------------------------------------

    if (teste.tipo === "ATIVIDADE") {
        const curso = teste.modulo?.sessao.curso;

        if (!curso || curso.status !== "ATIVO") {
            throw new AttemptsServiceError(
                "CURSO_INDISPONIVEL",
                "O curso desta atividade não está disponível.",
            );
        }

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

        if (!inscricao) {
            throw new AttemptsServiceError(
                "SEM_ACESSO_CURSO",
                "Você precisa estar inscrito no curso para realizar esta atividade.",
            );
        }
    }

    // -------------------------------------------------
    // SELECIONAR QUESTÕES
    // -------------------------------------------------

    let questaoIds: string[] = [];

    if (teste.tipo === "ATIVIDADE") {
        // Atividades utilizam as questões previamente
        // selecionadas pelo professor/parceiro.

        questaoIds = teste.questoes.map(
            (questao) => questao.idQuestao,
        );
    } else {
        // Simulados sorteiam questões no início
        // de cada tentativa.

        const questoesDisponiveis = await prisma.questao.findMany({
            where: {
                dificuldade: teste.dificuldade ?? undefined,
            },
            select: {
                id: true,
            },
        });

        if (
            questoesDisponiveis.length <
            teste.quantidadeQuestoes
        ) {
            throw new AttemptsServiceError(
                "QUESTOES_INSUFICIENTES",
                "Não existem questões suficientes para gerar este simulado.",
            );
        }

        questaoIds = embaralhar(
            questoesDisponiveis.map((questao) => questao.id),
        )
            .slice(0, teste.quantidadeQuestoes);
    }

    if (questaoIds.length === 0) {
        throw new AttemptsServiceError(
            "SEM_QUESTOES",
            "Este teste não possui questões disponíveis.",
        );
    }

    // -------------------------------------------------
    // BUSCAR QUESTÕES E ALTERNATIVAS
    // -------------------------------------------------

    const questoes = await prisma.questao.findMany({
        where: {
            id: {
                in: questaoIds,
            },
        },

        select: {
            id: true,
            enunciado: true,

            alternativaCorreta: {
                select: {
                    letra: true,
                },
            },

            alternativas: {
                orderBy: {
                    letra: "asc",
                },
                select: {
                    letra: true,
                    texto: true,
                },
            },
        },
    });

    const questoesOrdenadas = questaoIds.map((id) =>
        questoes.find((questao) => questao.id === id),
    );

    if (
        questoesOrdenadas.some(
            (questao) =>
                !questao ||
                !questao.alternativaCorreta ||
                questao.alternativas.length === 0,
        )
    ) {
        throw new AttemptsServiceError(
            "QUESTOES_INCOMPLETAS",
            "Uma ou mais questões não possuem alternativas ou gabarito configurado.",
        );
    }

    // -------------------------------------------------
    // CRIAR TENTATIVA E SNAPSHOTS
    // -------------------------------------------------

    return prisma.$transaction(async (tx) => {
        const tentativa = await tx.tentativaTeste.create({
            data: {
                idUsuario,
                idTeste,
            },

            select: {
                id: true,
                idUsuario: true,
                idTeste: true,
                iniciadoEm: true,
            },
        });

        await tx.tentativaQuestao.createMany({
            data: questoesOrdenadas.map((questao) => ({
                idTentativa: tentativa.id,
                idQuestao: questao!.id,

                enunciado: questao!.enunciado,

                alternativaA:
                    questao!.alternativas.find(
                        (a) => a.letra === "A",
                    )?.texto ?? null,

                alternativaB:
                    questao!.alternativas.find(
                        (a) => a.letra === "B",
                    )?.texto ?? null,

                alternativaC:
                    questao!.alternativas.find(
                        (a) => a.letra === "C",
                    )?.texto ?? null,

                alternativaD:
                    questao!.alternativas.find(
                        (a) => a.letra === "D",
                    )?.texto ?? null,

                alternativaE:
                    questao!.alternativas.find(
                        (a) => a.letra === "E",
                    )?.texto ?? null,

                respostaCorreta:
                    questao!.alternativaCorreta!.letra,
            })),
        });

        // Nunca retornar o gabarito ao usuário.
        const questoesParaUsuario =
            await tx.tentativaQuestao.findMany({
                where: {
                    idTentativa: tentativa.id,
                },

                select: {
                    idQuestao: true,
                    enunciado: true,
                    alternativaA: true,
                    alternativaB: true,
                    alternativaC: true,
                    alternativaD: true,
                    alternativaE: true,
                },
            });

        return {
            tentativa,
            teste: {
                id: teste.id,
                tipo: teste.tipo,
                tema: teste.tema,
                tempoMinutos: teste.tempoMinutos,
                quantidadeQuestoes: questoesParaUsuario.length,
            },
            questoes: questoesParaUsuario,
        };
    });
}

// -----------------------------------------------------
// ENVIAR RESPOSTAS E FINALIZAR
// -----------------------------------------------------

export async function enviarRespostas(
    idTentativa: string,
    idUsuario: string,
    respostas: {
        idQuestao: string;
        resposta: "A" | "B" | "C" | "D" | "E" | null;
    }[],
) {
    return prisma.$transaction(async (tx) => {
        const tentativa = await tx.tentativaTeste.findUnique({
            where: {
                id: idTentativa,
            },

            include: {
                questoes: true,
            },
        });

        if (!tentativa) {
            throw new AttemptsServiceError(
                "TENTATIVA_NAO_ENCONTRADA",
                "Tentativa não encontrada.",
            );
        }

        if (tentativa.idUsuario !== idUsuario) {
            throw new AttemptsServiceError(
                "SEM_PERMISSAO",
                "Você não pode enviar respostas para esta tentativa.",
            );
        }

        if (tentativa.enviadoEm) {
            throw new AttemptsServiceError(
                "TENTATIVA_FINALIZADA",
                "Esta tentativa já foi finalizada.",
            );
        }

        const questoesIds = tentativa.questoes.map(
            (questao) => questao.idQuestao,
        );

        const respostasIds = respostas.map(
            (resposta) => resposta.idQuestao,
        );

        if (
            new Set(respostasIds).size !== respostasIds.length ||
            respostasIds.some(
                (id) => !questoesIds.includes(id),
            )
        ) {
            throw new AttemptsServiceError(
                "RESPOSTAS_INVALIDAS",
                "Existem respostas duplicadas ou questões que não pertencem a esta tentativa.",
            );
        }

        let acertos = 0;

        for (const questao of tentativa.questoes) {
            const resposta = respostas.find(
                (item) => item.idQuestao === questao.idQuestao,
            );

            const respostaUsuario = resposta?.resposta ?? null;

            const acertou =
                respostaUsuario !== null &&
                respostaUsuario === questao.respostaCorreta;

            if (acertou) {
                acertos++;
            }

            await tx.tentativaQuestao.update({
                where: {
                    id: questao.id,
                },

                data: {
                    respostaUsuario,
                    acertou,
                },
            });
        }

        const totalQuestoes = tentativa.questoes.length;

        const notaFinal =
            totalQuestoes > 0
                ? (acertos / totalQuestoes) * 100
                : 0;

        // Tempo calculado pelo servidor, em segundos.
        const tempoConsumido = Math.max(
            0,
            Math.floor(
                (Date.now() - tentativa.iniciadoEm.getTime()) / 1000,
            ),
        );

        const finalizada = await tx.tentativaTeste.update({
            where: {
                id: idTentativa,
            },

            data: {
                tempoConsumido,
                notaFinal,
                enviadoEm: new Date(),
            },

            select: {
                id: true,
                idTeste: true,
                tempoConsumido: true,
                notaFinal: true,
                enviadoEm: true,
            },
        });

        return {
            tentativa: finalizada,
            resultado: {
                totalQuestoes,
                acertos,
                erros: totalQuestoes - acertos,
                notaFinal,
            },
        };
    });
}

// -----------------------------------------------------
// LISTAR TENTATIVAS DO USUÁRIO
// -----------------------------------------------------

export async function listarTentativas(
    idUsuario: string,
    pagina: number,
    limite: number,
) {
    const where = {
        idUsuario,
    };

    const [tentativas, total] = await prisma.$transaction([
        prisma.tentativaTeste.findMany({
            where,
            orderBy: {
                iniciadoEm: "desc",
            },
            skip: (pagina - 1) * limite,
            take: limite,
            select: {
                id: true,
                idTeste: true,
                tempoConsumido: true,
                notaFinal: true,
                iniciadoEm: true,
                enviadoEm: true,

                teste: {
                    select: {
                        tipo: true,
                        tema: true,
                        quantidadeQuestoes: true,
                    },
                },
            },
        }),

        prisma.tentativaTeste.count({
            where,
        }),
    ]);

    return {
        dados: tentativas,
        paginacao: {
            pagina,
            limite,
            total,
            totalPaginas: Math.ceil(total / limite),
        },
    };
}

// -----------------------------------------------------
// CONSULTAR RESULTADO DE UMA TENTATIVA
// -----------------------------------------------------

export async function consultarTentativa(
    idTentativa: string,
    idUsuario: string,
) {
    const tentativa = await prisma.tentativaTeste.findUnique({
        where: {
            id: idTentativa,
        },

        include: {
            teste: {
                select: {
                    id: true,
                    tipo: true,
                    tema: true,
                    tempoMinutos: true,
                },
            },

            questoes: {
                select: {
                    idQuestao: true,
                    enunciado: true,
                    alternativaA: true,
                    alternativaB: true,
                    alternativaC: true,
                    alternativaD: true,
                    alternativaE: true,
                    respostaUsuario: true,
                    respostaCorreta: true,
                    acertou: true,
                },
            },
        },
    });

    if (!tentativa) {
        throw new AttemptsServiceError(
            "TENTATIVA_NAO_ENCONTRADA",
            "Tentativa não encontrada.",
        );
    }

    if (tentativa.idUsuario !== idUsuario) {
        throw new AttemptsServiceError(
            "SEM_PERMISSAO",
            "Você não pode consultar esta tentativa.",
        );
    }

    // Antes da finalização, não disponibiliza o gabarito.
    if (!tentativa.enviadoEm) {
        return {
            ...tentativa,
            questoes: tentativa.questoes.map((questao) => ({
                ...questao,
                respostaCorreta: undefined,
                acertou: undefined,
            })),
        };
    }

    return tentativa;
}
