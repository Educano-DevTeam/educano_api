import { Prisma } from "../../../generated/prisma/client.js";

import { prisma } from "../../../config/prisma.js";

import {
    enviarArquivo,
    excluirArquivo,
    consultarArquivo,
} from "../../files/services/files.service.js";

import type {
    CriarCursoInput,
    AtualizarCursoInput,
    FiltrosCursosInput,
} from "../types/courses.types.js";
import { cursoEstaCompleto, mesclarDadosCurso, obterStatusInicialCurso } from "../utils/courses.utils.js";
import { consultarAcessoCurso } from "./course-permissions.service.js";

const CURSOS_POR_PAGINA = 20;

export class CoursesServiceError extends Error {
    constructor(
        public readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = "CoursesServiceError";
    }
}

function validarUuid(id: string) {
    if (
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    ) {
        throw new CoursesServiceError(
            "ID_INVALIDO",
            "Identificador de curso inválido.",
        );
    }
}

async function enviarCapaCurso(
    arquivo: Express.Multer.File | undefined,
    idUsuario: string,
) {
    if (!arquivo) return null;

    try {
        const resultado = await enviarArquivo({
            arquivo,
            idOrigem: idUsuario,
            tipo: "IMAGEM",
            finalidade: "CAPA_CURSO",
        });

        return resultado.id;
    } catch (error) {
        throw new CoursesServiceError(
            "ERRO_UPLOAD_CAPA",
            "O upload da capa falhou. O curso não pode ser salvo sem concluir o envio da imagem.",
        );
    }
}

async function validarCapa(
    idCapa: string | null | undefined,
    idUsuario: string,
) {
    if (!idCapa) return;

    const arquivo = await prisma.arquivo.findFirst({
        where: {
            id: idCapa,
            idOrigem: idUsuario,
            finalidade: "CAPA_CURSO",
            status: "CONCLUIDO",
            tipo: "IMAGEM",
        },
        select: {
            id: true,
        },
    });

    if (!arquivo) {
        throw new CoursesServiceError(
            "CAPA_INVALIDA",
            "A capa informada não existe, não pertence ao usuário ou não foi enviada corretamente.",
        );
    }
}

function verificarPermissao(
    responsavelId: string,
    usuarioId: string,
    tipoUsuario: string,
) {
    const ehResponsavel = responsavelId === usuarioId;
    const ehAdmin = tipoUsuario === "ADMIN";

    if (!ehResponsavel && !ehAdmin) {
        throw new CoursesServiceError(
            "SEM_PERMISSAO",
            "Você não tem permissão para modificar este curso.",
        );
    }
}

function selecionarDadosCurso() {
    return {
        id: true,
        nome: true,
        categoria: true,
        cargaHoraria: true,
        status: true,
        vagas: true,
        preco: true,
        descricao: true,
        cor: true,
        idCapa: true,
        iconeCapa: true,
        criadoEm: true,
        atualizadoEm: true,
        autorizadoEm: true,

        arquivoCapa: {
            select: {
                id: true,
                nomeOriginal: true,
                contentType: true,
                tamanhoBytes: true,
            },
        },

        responsavel: {
            select: {
                id: true,
                nome: true,
                tipo: true,
            },
        },

        adminAutorizador: {
            select: {
                id: true,
                nome: true,
            },
        },
    } as const;
}

function serializarCurso<
    T extends {
        arquivoCapa: {
            tamanhoBytes: bigint;
        } | null;
    },
>(curso: T) {
    return {
        ...curso,
        arquivoCapa: curso.arquivoCapa
            ? {
                ...curso.arquivoCapa,
                tamanhoBytes: curso.arquivoCapa.tamanhoBytes.toString(),
            }
            : null,
    };
}

// -----------------------------------------------------
// CRIAR CURSO
// -----------------------------------------------------

export async function criarCurso(
    idUsuario: string,
    dados: CriarCursoInput,
    arquivo?: Express.Multer.File,
) {
    // A imagem é enviada antes de criar o curso.
    const idCapa = await enviarCapaCurso(arquivo, idUsuario);

    const status = obterStatusInicialCurso(dados, idCapa);

    try {
        const curso = await prisma.$transaction(async (tx) => {
            const usuario = await tx.usuario.findUnique({
                where: { id: idUsuario },
                select: {
                    id: true,
                    tipo: true,
                    status: true,
                },
            });

            if (!usuario || usuario.status !== "ATIVO") {
                throw new CoursesServiceError(
                    "USUARIO_INDISPONIVEL",
                    "Não foi possível identificar um usuário ativo para criar o curso.",
                );
            }

            const curso = await tx.curso.create({
                data: {
                    nome: dados.nome,
                    categoria: dados.categoria,
                    cargaHoraria: dados.cargaHoraria ?? null,
                    descricao: dados.descricao?.trim() || null,
                    vagas: dados.vagas ?? null,
                    preco: dados.preco ?? null,
                    cor: dados.cor ?? null,

                    idCapa,
                    iconeCapa: idCapa ? null : dados.capa ?? null,

                    idResponsavel: idUsuario,
                    status,
                },
                select: selecionarDadosCurso(),
            });

            // Alunos que criam cursos passam a ser parceiros.
            if (usuario.tipo === "ALUNO") {
                await tx.usuario.update({
                    where: { id: idUsuario },
                    data: {
                        tipo: "PARCEIRO",
                        atualizadoEm: new Date(),
                    },
                });
            }

            return curso;
        });

        return serializarCurso(curso);
    } catch (error) {
        // Se o curso não puder ser criado, remove a imagem enviada.
        if (idCapa) {
            try {
                await excluirArquivo(idCapa);
            } catch (erroExclusao) {
                console.error(
                    "Falha ao limpar a capa após erro na criação do curso:",
                    erroExclusao,
                );
            }
        }

        if (error instanceof CoursesServiceError) throw error;

        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
        ) {
            throw new CoursesServiceError(
                "CAPA_JA_UTILIZADA",
                "Esta imagem já está associada a outro curso.",
            );
        }

        throw error;
    }
    
}

// -----------------------------------------------------
// CONSULTAR CURSO
// -----------------------------------------------------

export async function consultarCurso(
    id: string,
    idUsuario: string,
    tipoUsuario: string,
) {
    validarUuid(id);

    const curso = await prisma.curso.findUnique({
        where: { id },
        select: selecionarDadosCurso(),
    });

    if (!curso) {
        throw new CoursesServiceError(
            "CURSO_NAO_ENCONTRADO",
            "Curso não encontrado.",
        );
    }

    const ehResponsavel = curso.responsavel.id === idUsuario;
    const ehAdmin = tipoUsuario === "ADMIN";

    // Cursos não ativos ficam restritos ao responsável e ao administrador.
    if (curso.status !== "ATIVO" && !ehResponsavel && !ehAdmin) {
        throw new CoursesServiceError(
            "CURSO_NAO_DISPONIVEL",
            "Este curso não está disponível.",
        );
    }

    return serializarCurso(curso);
}


// -----------------------------------------------------
// CONSULTAR CONTEÚDO COMPLETO DO CURSO
// -----------------------------------------------------

export async function consultarConteudoCurso(
    id: string,
    idUsuario: string,
    tipoUsuario: string,
) {
    validarUuid(id);

    // Verifica se o usuário pode visualizar o curso e seu conteúdo.
    const acesso = await consultarAcessoCurso(
        id,
        idUsuario,
        tipoUsuario,
    );

    if (!acesso.existe) {
        throw new CoursesServiceError(
            "CURSO_NAO_ENCONTRADO",
            "Curso não encontrado.",
        );
    }

    if (!acesso.podeLer) {
        throw new CoursesServiceError(
            "SEM_ACESSO_CURSO",
            "Você precisa estar inscrito em um curso ativo ou possuir autorização para acessar seu conteúdo.",
        );
    }

    // Busca os dados do curso e toda a sua estrutura.
    const curso = await prisma.curso.findUnique({
        where: { id },

        select: {
            id: true,
            nome: true,
            categoria: true,
            status: true,
            cargaHoraria: true,
            vagas: true,
            preco: true,
            descricao: true,
            cor: true,
            idCapa: true,
            iconeCapa: true,
            criadoEm: true,
            atualizadoEm: true,

            responsavel: {
                select: {
                    id: true,
                    nome: true,
                    tipo: true,
                },
            },

            professores: {
                select: {
                    professor: {
                        select: {
                            id: true,
                            nome: true,
                            tipo: true,
                        },
                    },
                },
            },

            _count: {
                select: {
                    inscricoes: true,
                    sessoes: true,
                },
            },

            sessoes: {
                orderBy: [
                    { criadoEm: "asc" },
                    { id: "asc" },
                ],

                select: {
                    id: true,
                    titulo: true,
                    subtitulo: true,
                    descricao: true,
                    criadoEm: true,

                    responsavel: {
                        select: {
                            id: true,
                            nome: true,
                        },
                    },

                    modulos: {
                        orderBy: [
                            { criadoEm: "asc" },
                            { id: "asc" },
                        ],

                        select: {
                            id: true,
                            titulo: true,
                            descricao: true,
                            criadoEm: true,

                            responsavel: {
                                select: {
                                    id: true,
                                    nome: true,
                                },
                            },

                            aulas: {
                                orderBy: [
                                    { criadoEm: "asc" },
                                    { id: "asc" },
                                ],

                                select: {
                                    id: true,
                                    titulo: true,
                                    descricao: true,
                                    idArquivo: true,
                                    tipo: true,
                                    quantidadePaginas: true,
                                    duracaoMinutos: true,
                                    criadoEm: true,
                                },
                            },

                            testes: {
                                where: {
                                    tipo: "ATIVIDADE",
                                },

                                orderBy: [
                                    { criadoEm: "asc" },
                                    { id: "asc" },
                                ],

                                select: {
                                    id: true,
                                    tipo: true,
                                    tema: true,
                                    tempoMinutos: true,
                                    quantidadeQuestoes: true,
                                    criadoEm: true,

                                    responsavel: {
                                        select: {
                                            id: true,
                                            nome: true,
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
    });

    if (!curso) {
        throw new CoursesServiceError(
            "CURSO_NAO_ENCONTRADO",
            "Curso não encontrado.",
        );
    }

    
    // Identifica todos os materiais e atividades do curso.
    const idsAulas = curso.sessoes.flatMap((sessao) =>
        sessao.modulos.flatMap((modulo) =>
            modulo.aulas.map((aula) => aula.id),
        ),
    );

    const idsTestes = curso.sessoes.flatMap((sessao) =>
        sessao.modulos.flatMap((modulo) =>
            modulo.testes.map((teste) => teste.id),
        ),
    );

    const filtrosProgresso = [
        ...(idsAulas.length > 0
            ? [{ idAula: { in: idsAulas } }]
            : []),
        ...(idsTestes.length > 0
            ? [{ idTeste: { in: idsTestes } }]
            : []),
    ];

    const progressos = filtrosProgresso.length > 0
        ? await prisma.progresso.findMany({
            where: {
                idUsuario,
                concluida: true,
                OR: filtrosProgresso,
            },
            select: {
                idAula: true,
                idTeste: true,
            },
        })
        : [];

    const aulasConcluidas = new Set(
        progressos
            .map((item) => item.idAula)
            .filter((id): id is string => id !== null),
    );

    const testesConcluidos = new Set(
        progressos
            .map((item) => item.idTeste)
            .filter((id): id is string => id !== null),
    );

    function calcularProgresso(
        total: number,
        concluidos: number,
    ) {
        return {
            total,
            concluidos,
            percentual: total > 0
                ? Math.round((concluidos / total) * 100)
                : 0,
        };
    }

    // Gera a URL temporária da capa, quando existir.
    const capa = curso.idCapa
        ? await consultarArquivo(curso.idCapa)
        : null;

    if (curso.idCapa && !capa) {
        throw new CoursesServiceError(
            "CAPA_INDISPONIVEL",
            "A capa deste curso não está disponível.",
        );
    }

    // Percorre as sessões, módulos e aulas para gerar
    // as URLs temporárias dos materiais.
    
    const sessoes = await Promise.all(
        curso.sessoes.map(async (sessao) => {
            const modulos = await Promise.all(
                sessao.modulos.map(async (modulo) => {
                    const aulas = await Promise.all(
                        modulo.aulas.map(async (aula) => {
                            const arquivo = aula.idArquivo
                                ? await consultarArquivo(aula.idArquivo)
                                : null;

                            if (aula.idArquivo && !arquivo) {
                                throw new CoursesServiceError(
                                    "MATERIAL_INDISPONIVEL",
                                    `O material da aula "${aula.titulo}" não está disponível.`,
                                );
                            }

                            const {
                                idArquivo,
                                ...dadosAula
                            } = aula;

                            return {
                                ...dadosAula,
                                concluida: aulasConcluidas.has(aula.id),
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
                        }),
                    );

                    const atividades = modulo.testes.map((teste) => ({
                        ...teste,
                        concluida: testesConcluidos.has(teste.id),
                    }));

                    const total = aulas.length + atividades.length;

                    const concluidos =
                        aulas.filter((aula) => aula.concluida).length +
                        atividades.filter((teste) => teste.concluida).length;

                    return {
                        id: modulo.id,
                        titulo: modulo.titulo,
                        descricao: modulo.descricao,
                        criadoEm: modulo.criadoEm,
                        responsavel: modulo.responsavel,
                        aulas,
                        atividades,
                        progresso: calcularProgresso(total, concluidos),
                    };
                }),
            );

            const total = modulos.reduce(
                (soma, modulo) => soma + modulo.progresso.total,
                0,
            );

            const concluidos = modulos.reduce(
                (soma, modulo) => soma + modulo.progresso.concluidos,
                0,
            );

            return {
                ...sessao,
                modulos,
                progresso: calcularProgresso(total, concluidos),
            };
        }),
    );

    const totalCurso = sessoes.reduce(
        (soma, sessao) => soma + sessao.progresso.total,
        0,
    );

    const concluidosCurso = sessoes.reduce(
        (soma, sessao) => soma + sessao.progresso.concluidos,
        0,
    );

    const {
        idCapa,
        sessoes: _sessoesOriginais,
        preco,
        ...dadosCurso
    } = curso;

    return {
        ...dadosCurso,

        preco: preco?.toString() ?? null,

        capa: capa
            ? {
                id: capa.id,
                nomeOriginal: capa.nomeOriginal,
                contentType: capa.contentType,
                tamanhoBytes: capa.tamanhoBytes,
                url: capa.url,
            }
            : {
                id: null,
                icone: curso.iconeCapa,
                url: null,
            },

        professores: curso.professores.map(
            (vinculo) => vinculo.professor,
        ),

        quantidadeAlunosInscritos: curso._count.inscricoes,

        quantidadeSessoes: curso._count.sessoes,

        progresso: calcularProgresso(
            totalCurso,
            concluidosCurso,
        ),

        sessoes,
    };
}

// -----------------------------------------------------
// LISTAR CURSOS DO PRÓPRIO USUÁRIO
// -----------------------------------------------------


export async function listarMeusCursosInscritos(
    idUsuario: string,
) {
    // Busca os cursos nos quais o usuário está inscrito
    // e aqueles dos quais ele é responsável.
    const [inscricoes, cursosProprios] = await Promise.all([
        prisma.inscricao.findMany({
            where: { idUsuario },
            orderBy: [
                { criadoEm: "desc" },
                { id: "asc" },
            ],
            select: {
                criadoEm: true,
                curso: {
                    select: {
                        id: true,
                        nome: true,
                        descricao: true,
                        cargaHoraria: true,
                        idCapa: true,
                        sessoes: {
                            select: {
                                modulos: {
                                    select: {
                                        aulas: {
                                            select: { id: true },
                                        },
                                        testes: {
                                            where: {
                                                tipo: "ATIVIDADE",
                                            },
                                            select: { id: true },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        }),

        prisma.curso.findMany({
            where: { idResponsavel: idUsuario },
            orderBy: [
                { criadoEm: "desc" },
                { id: "asc" },
            ],
            select: {
                id: true,
                nome: true,
                descricao: true,
                cargaHoraria: true,
                idCapa: true,
                sessoes: {
                    select: {
                        modulos: {
                            select: {
                                aulas: {
                                    select: { id: true },
                                },
                                testes: {
                                    where: {
                                        tipo: "ATIVIDADE",
                                    },
                                    select: { id: true },
                                },
                            },
                        },
                    },
                },
            },
        }),
    ]);

    // Estrutura única para reunir cursos inscritos e próprios.
    type CursoLista = (typeof inscricoes)[number]["curso"];

    const cursosPorId = new Map<
        string,
        {
            curso: CursoLista;
            inscritoEm: Date | null;
            meuCurso: boolean;
        }
    >();

    // Primeiro, adiciona os cursos em que o usuário está inscrito.
    for (const inscricao of inscricoes) {
        cursosPorId.set(inscricao.curso.id, {
            curso: inscricao.curso,
            inscritoEm: inscricao.criadoEm,
            meuCurso: false,
        });
    }

    // Depois, adiciona os cursos próprios.
    // Se o curso já estiver na lista, apenas atualiza meuCurso.
    for (const curso of cursosProprios) {
        const existente = cursosPorId.get(curso.id);

        cursosPorId.set(curso.id, {
            curso,
            inscritoEm: existente?.inscritoEm ?? null,
            meuCurso: true,
        });
    }

    const cursosUnificados = Array.from(cursosPorId.values());

    // Reúne os IDs de aulas e atividades de todos os cursos.
    const idsAulas = cursosUnificados.flatMap(({ curso }) =>
        curso.sessoes.flatMap((sessao) =>
            sessao.modulos.flatMap((modulo) =>
                modulo.aulas.map((aula) => aula.id),
            ),
        ),
    );

    const idsAtividades = cursosUnificados.flatMap(({ curso }) =>
        curso.sessoes.flatMap((sessao) =>
            sessao.modulos.flatMap((modulo) =>
                modulo.testes.map((teste) => teste.id),
            ),
        ),
    );

    // Busca, em uma única consulta, as conclusões do usuário.
    const filtrosProgresso = [
        ...(idsAulas.length > 0
            ? [{ idAula: { in: idsAulas } }]
            : []),
        ...(idsAtividades.length > 0
            ? [{ idTeste: { in: idsAtividades } }]
            : []),
    ];

    const progressos = filtrosProgresso.length > 0
        ? await prisma.progresso.findMany({
            where: {
                idUsuario,
                concluida: true,
                OR: filtrosProgresso,
            },
            select: {
                idAula: true,
                idTeste: true,
            },
        })
        : [];

    const aulasConcluidas = new Set(
        progressos
            .map((item) => item.idAula)
            .filter((id): id is string => id !== null),
    );

    const atividadesConcluidas = new Set(
        progressos
            .map((item) => item.idTeste)
            .filter((id): id is string => id !== null),
    );

    // Calcula o progresso individual de cada curso.
    const cursos = await Promise.all(
        cursosUnificados.map(async ({
            curso,
            inscritoEm,
            meuCurso,
        }) => {
            const aulas = curso.sessoes.flatMap((sessao) =>
                sessao.modulos.flatMap((modulo) => modulo.aulas),
            );

            const atividades = curso.sessoes.flatMap((sessao) =>
                sessao.modulos.flatMap((modulo) => modulo.testes),
            );

            const total = aulas.length + atividades.length;

            const concluidos =
                aulas.filter((aula) =>
                    aulasConcluidas.has(aula.id),
                ).length +
                atividades.filter((atividade) =>
                    atividadesConcluidas.has(atividade.id),
                ).length;

            const percentual = total > 0
                ? Math.round((concluidos / total) * 100)
                : 0;

            // Gera a URL temporária da capa.
            const capa = curso.idCapa
                ? await consultarArquivo(curso.idCapa)
                : null;

            return {
                id: curso.id,
                nome: curso.nome,
                descricao: curso.descricao,
                cargaHoraria: curso.cargaHoraria,
                capa: capa?.url ?? null,

                inscritoEm,
                meuCurso,

                progresso: {
                    total,
                    concluidos,
                    percentual,
                },
            };
        }),
    );

    // Separa os cursos em que o usuário está inscrito
    // para calcular seu progresso como aluno.
    const cursosInscritos = cursos.filter(
        (curso) => curso.inscritoEm !== null,
    );

    const totalCursos = cursos.length;
    const totalInscritos = cursosInscritos.length;
    const totalMeusCursos = cursos.filter(
        (curso) => curso.meuCurso,
    ).length;

    // A média considera somente cursos inscritos,
    // não os cursos que o usuário apenas administra.
    const progressoGeral = totalInscritos > 0
        ? Math.round(
            cursosInscritos.reduce(
                (soma, curso) => soma + curso.progresso.percentual,
                0,
            ) / totalInscritos,
        )
        : 0;

    return {
        totalCursos,
        totalInscritos,
        totalMeusCursos,
        progressoGeral,
        cursos,
    };
}

// -----------------------------------------------------
// LISTAR E PESQUISAR CURSOS
// -----------------------------------------------------

export async function listarCursos(
    filtros: FiltrosCursosInput,
    idUsuario: string,
    tipoUsuario: string,
) {
    const ehAdmin = tipoUsuario === "ADMIN";

    const where: Prisma.CursoWhereInput = {
        ...(filtros.nome && {
            nome: {
                contains: filtros.nome,
                mode: "insensitive",
            },
        }),

        ...(filtros.categoria && {
            categoria: filtros.categoria,
        }),

        ...(ehAdmin
            ? filtros.status
                ? { status: filtros.status }
                : {}
            : { status: "ATIVO" }),
    };

    const skip = (filtros.pagina - 1) * CURSOS_POR_PAGINA;

    const [cursos, total] = await prisma.$transaction([
        prisma.curso.findMany({
            where,
            skip,
            take: CURSOS_POR_PAGINA,

            orderBy: [
                { criadoEm: "desc" },
                { id: "asc" },
            ],

            select: {
                id: true,
                nome: true,
                categoria: true,
                cargaHoraria: true,
                status: true,
                vagas: true,
                preco: true,
                descricao: true,
                cor: true,
                idCapa: true,
                iconeCapa: true,
                criadoEm: true,

                responsavel: {
                    select: {
                        id: true,
                        nome: true,
                    },
                },
            },
        }),

        prisma.curso.count({ where }),
    ]);

    const totalPaginas = Math.ceil(total / CURSOS_POR_PAGINA);

    return {
        dados: cursos,
        paginacao: {
            pagina: filtros.pagina,
            porPagina: CURSOS_POR_PAGINA,
            total,
            totalPaginas,
            temMais: filtros.pagina < totalPaginas,
            proximaPagina:
                filtros.pagina < totalPaginas
                    ? filtros.pagina + 1
                    : null,
        },
    };
}

// -----------------------------------------------------
// ATUALIZAR CURSO
// -----------------------------------------------------

export async function atualizarCurso(
  id: string,
  idUsuario: string,
  tipoUsuario: string,
  dados: AtualizarCursoInput,
  arquivo?: Express.Multer.File,
) {
  validarUuid(id);

  const cursoAtual = await prisma.curso.findUnique({
    where: { id },
    select: {
      id: true,
      idResponsavel: true,
      idCapa: true,
      iconeCapa: true,
      nome: true,
      categoria: true,
      descricao: true,
      status: true,
    },
  });

  if (!cursoAtual) {
    throw new CoursesServiceError(
      "CURSO_NAO_ENCONTRADO",
      "Curso não encontrado.",
    );
  }

  verificarPermissao(
    cursoAtual.idResponsavel,
    idUsuario,
    tipoUsuario,
  );

  if (dados.status !== undefined && tipoUsuario !== "ADMIN") {
    throw new CoursesServiceError(
      "SOMENTE_ADMIN",
      "Somente administradores podem alterar o status de um curso.",
    );
  }

  // A imagem nova é enviada antes da atualização do curso.
  const idCapaNova = await enviarCapaCurso(arquivo, idUsuario);

  const alterouCapa =
    arquivo !== undefined ||
    dados.capa !== undefined;

  const dadosCompletos = mesclarDadosCurso(
    cursoAtual,
    dados,
    arquivo ? idCapaNova : undefined,
  );

  // Se a requisição enviou um ícone ou pediu remoção da capa,
  // não deve permanecer uma imagem antiga associada.
  if (alterouCapa && !arquivo) {
    dadosCompletos.idCapa = null;
    dadosCompletos.iconeCapa = dados.capa || null;
  }

  const completo = cursoEstaCompleto(dadosCompletos);

  let novoStatus = dados.status ?? cursoAtual.status;

  if (dados.status === undefined) {
    if (!completo) {
      novoStatus = "RASCUNHO";
    } else if (cursoAtual.status === "RASCUNHO") {
      novoStatus = "INATIVO";
    }
  }

  if (novoStatus === "ATIVO" && !completo) {
    if (idCapaNova) {
      await excluirArquivo(idCapaNova).catch((error) => {
        console.error("Falha ao remover nova capa:", error);
      });
    }

    throw new CoursesServiceError(
      "CURSO_INCOMPLETO",
      "Preencha nome, categoria, descrição e capa antes de ativar o curso.",
    );
  }

  const ativandoCurso =
    novoStatus === "ATIVO" &&
    cursoAtual.status !== "ATIVO";

  try {
    const cursoAtualizado = await prisma.curso.update({
      where: { id },
      data: {
        ...(dados.nome !== undefined && { nome: dados.nome }),

        ...(dados.categoria !== undefined && {
          categoria: dados.categoria,
        }),

        ...(dados.cargaHoraria !== undefined && {
            cargaHoraria: dados.cargaHoraria,
        }),

        ...(dados.descricao !== undefined && {
          descricao: dados.descricao?.trim() || null,
        }),

        ...(dados.vagas !== undefined && {
          vagas: dados.vagas,
        }),

        ...(dados.preco !== undefined && {
          preco: dados.preco,
        }),

        ...(dados.cor !== undefined && {
          cor: dados.cor,
        }),

        ...(alterouCapa && {
          idCapa: arquivo ? idCapaNova : null,
          iconeCapa: arquivo ? null : dados.capa || null,
        }),

        status: novoStatus,

        ...(ativandoCurso && {
          idAdminAutorizador: idUsuario,
          autorizadoEm: new Date(),
        }),

        ...(cursoAtual.status === "ATIVO" && novoStatus !== "ATIVO" && {
          idAdminAutorizador: null,
          autorizadoEm: null,
        }),
      },
      select: selecionarDadosCurso(),
    });

    // A atualização foi concluída; agora podemos remover a capa antiga.
    if (
      alterouCapa &&
      cursoAtual.idCapa &&
      cursoAtual.idCapa !== idCapaNova
    ) {
      try {
        await excluirArquivo(cursoAtual.idCapa);
      } catch (error) {
        console.error(
          "Não foi possível remover a capa antiga:",
          error,
        );
      }
    }

    return serializarCurso(cursoAtualizado);
  } catch (error) {
    // Se a atualização falhou, a nova imagem não deve ficar órfã.
    if (idCapaNova) {
      try {
        await excluirArquivo(idCapaNova);
      } catch (erroExclusao) {
        console.error(
          "Falha ao remover nova capa após erro na atualização:",
          erroExclusao,
        );
      }
    }

    throw error;
  }
}

// -----------------------------------------------------
// EXCLUIR CURSO
// -----------------------------------------------------

export async function excluirCurso(
    id: string,
    idUsuario: string,
    tipoUsuario: string,
) {
    validarUuid(id);

    const curso = await prisma.curso.findUnique({
        where: { id },
        select: {
            id: true,
            idResponsavel: true,
            idCapa: true,
        },
    });

    if (!curso) {
        throw new CoursesServiceError(
            "CURSO_NAO_ENCONTRADO",
            "Curso não encontrado.",
        );
    }

    verificarPermissao(
        curso.idResponsavel,
        idUsuario,
        tipoUsuario,
    );

    await prisma.curso.delete({
        where: { id },
    });

    // O registro do curso é removido primeiro.
    // A remoção do arquivo no R2 é uma operação externa ao banco.
    if (curso.idCapa) {
        try {
            await excluirArquivo(curso.idCapa);
        } catch (error) {
            console.error(
                "Não foi possível remover a capa do curso no armazenamento:",
                error,
            );
        }
    }

    return { id: curso.id };
}