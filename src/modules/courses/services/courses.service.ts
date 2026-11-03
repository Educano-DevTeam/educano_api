import { Prisma } from "../../../generated/prisma/client.js";

import { prisma } from "../../../config/prisma.js";

import { excluirArquivo } from "../../files/services/files.service.js";

import type {
  CriarCursoInput,
  AtualizarCursoInput,
  FiltrosCursosInput,
} from "../types/courses.types.js";

import {
  cursoEstaCompleto,
  obterStatusInicialCurso,
  mesclarDadosCurso,
} from "../utils/courses.utils.js";

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
    criadoEm: true,
    atualizadoEm: true,
    autorizadoEm: true,

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

// -----------------------------------------------------
// CRIAR CURSO
// -----------------------------------------------------

export async function criarCurso(
  idUsuario: string,
  dados: CriarCursoInput,
) {
  await validarCapa(dados.idCapa, idUsuario);

  const status = obterStatusInicialCurso(dados);

  try {
    return await prisma.$transaction(async (tx) => {
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
          idCapa: dados.idCapa ?? null,
          idResponsavel: idUsuario,
          status,
        },
        select: selecionarDadosCurso(),
      });

      // Alunos que criam cursos passam a ser parceiros.
      // Professores e administradores mantêm seus tipos.
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
  } catch (error) {
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

  return curso;
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
        status: true,
        vagas: true,
        preco: true,
        descricao: true,
        cor: true,
        idCapa: true,
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
) {
  validarUuid(id);

  const cursoAtual = await prisma.curso.findUnique({
    where: { id },
    select: {
      id: true,
      idResponsavel: true,
      idCapa: true,
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

  // Alterações de status são exclusivas de administradores.
  if (dados.status !== undefined && tipoUsuario !== "ADMIN") {
    throw new CoursesServiceError(
      "SOMENTE_ADMIN",
      "Somente administradores podem alterar o status de um curso.",
    );
  }

  if (dados.idCapa !== undefined && dados.idCapa !== cursoAtual.idCapa) {
    await validarCapa(dados.idCapa, idUsuario);
  }

  const dadosCompletos = mesclarDadosCurso(
    cursoAtual,
    dados,
  );

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
    throw new CoursesServiceError(
      "CURSO_INCOMPLETO",
      "Preencha nome, categoria, descrição e capa antes de ativar o curso.",
    );
  }

  const ativandoCurso =
    novoStatus === "ATIVO" &&
    cursoAtual.status !== "ATIVO";

  return prisma.curso.update({
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
      ...(dados.idCapa !== undefined && {
        idCapa: dados.idCapa,
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