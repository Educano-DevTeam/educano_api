import { Prisma } from "../../../generated/prisma/client.js";

import { prisma } from "../../../config/prisma.js";

import {
    enviarArquivo,
    excluirArquivo,
} from "../../files/services/files.service.js";

import type {
    CriarCursoInput,
    AtualizarCursoInput,
    FiltrosCursosInput,
} from "../types/courses.types.js";
import { cursoEstaCompleto, mesclarDadosCurso, obterStatusInicialCurso } from "../utils/courses.utils.js";

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
// LISTAR E PESQUISAR CURSOS
// -----------------------------------------------------

export async function listarCursos(
    filtros: FiltrosCursosInput,
    idUsuario: string,
    tipoUsuario: string,
) {
    const ehAdmin = tipoUsuario === "ADMIN";

    // Além dos cursos ativos, quem cadastrou vê os próprios cursos.
    const visiveis: Prisma.CursoWhereInput = ehAdmin
        ? {}
        : { OR: [{ status: "ATIVO" }, { idResponsavel: idUsuario }] };

    const where: Prisma.CursoWhereInput = {
        AND: [
            visiveis,
            filtros.nome
                ? { nome: { contains: filtros.nome, mode: "insensitive" } }
                : {},
            filtros.categoria ? { categoria: filtros.categoria } : {},
            filtros.status ? { status: filtros.status } : {},
        ],
    };

    const skip = (filtros.pagina - 1) * CURSOS_POR_PAGINA;

    const [cursos, total, porStatus] = await prisma.$transaction([
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

                _count: { select: { inscricoes: true } },

                inscricoes: {
                    where: { idUsuario },
                    select: { turma: true },
                },

                sessoes: {
                    select: {
                        modulos: {
                            select: {
                                _count: { select: { aulas: true, testes: true } },
                            },
                        },
                    },
                },
            },
        }),

        prisma.curso.count({ where }),

        prisma.curso.groupBy({
            by: ["status"],
            where: visiveis,
            orderBy: { status: "asc" },
            _count: { _all: true },
        }),
    ]);

    const totalPaginas = Math.ceil(total / CURSOS_POR_PAGINA);

    const contarStatus = (status: string) => {
        const grupo = porStatus.find((g) => g.status === status);
        return typeof grupo?._count === "object" ? grupo._count._all ?? 0 : 0;
    };

    return {
        dados: cursos.map(({ _count, inscricoes, sessoes, ...curso }) => ({
            ...curso,
            inscritos: _count.inscricoes,
            inscrito: inscricoes.length > 0,
            turma: inscricoes[0]?.turma ?? null,
            podeEditar: ehAdmin || curso.responsavel.id === idUsuario,
            conteudo: {
                sessoes: sessoes.length,
                modulos: sessoes.reduce((soma, s) => soma + s.modulos.length, 0),
                aulas: sessoes.reduce(
                    (soma, s) => soma + s.modulos.reduce((t, m) => t + m._count.aulas + m._count.testes, 0),
                    0,
                ),
            },
        })),
        estatisticas: {
            ativos: contarStatus("ATIVO"),
            inativos: contarStatus("INATIVO"),
            rascunhos: contarStatus("RASCUNHO"),
        },
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