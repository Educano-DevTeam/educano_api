import { prisma } from "../../../config/prisma.js";

import type {
  CriarSessaoInput,
  AtualizarSessaoInput,
} from "../types/sessions.types.js";


import { consultarAcessoCurso } from "../../courses/services/course-permissions.service.js";

const uuidValido = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export class SessionsServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SessionsServiceError";
  }
}

function validarUuid(id: string) {
  if (!uuidValido(id)) {
    throw new SessionsServiceError(
      "ID_INVALIDO",
      "Identificador inválido.",
    );
  }
}

async function verificarAcessoCurso(
    idCurso: string,
    idUsuario: string,
    tipoUsuario: string,
    modo: "LEITURA" | "GERENCIAMENTO" = "GERENCIAMENTO",
) {
    validarUuid(idCurso);

    const acesso = await consultarAcessoCurso(
        idCurso,
        idUsuario,
        tipoUsuario,
    );

    if (!acesso.existe) {
        throw new SessionsServiceError(
            "CURSO_NAO_ENCONTRADO",
            "Curso não encontrado.",
        );
    }

    const permitido =
        modo === "GERENCIAMENTO"
            ? acesso.podeGerenciar
            : acesso.podeLer;

    if (!permitido) {
        throw new SessionsServiceError(
            "SEM_PERMISSAO",
            modo === "GERENCIAMENTO"
                ? "Você não tem permissão para administrar as sessões deste curso."
                : "Você não tem acesso às sessões deste curso.",
        );
    }

    return acesso.curso!;
}

async function verificarAcessoSessao(
    id: string,
    idUsuario: string,
    tipoUsuario: string,
    modo: "LEITURA" | "GERENCIAMENTO" = "GERENCIAMENTO",
) {
    const sessao = await buscarSessao(id);

    await verificarAcessoCurso(
        sessao.idCurso,
        idUsuario,
        tipoUsuario,
        modo,
    );

    return sessao;
}

async function buscarSessao(id: string) {
  validarUuid(id);

  const sessao = await prisma.sessao.findUnique({
    where: { id },
    select: {
      id: true,
      idCurso: true,
      titulo: true,
      subtitulo: true,
      descricao: true,
      criadoEm: true,
      atualizadoEm: true,

      responsavel: {
        select: {
          id: true,
          nome: true,
          tipo: true,
        },
      },

      _count: {
        select: {
          modulos: true,
        },
      },
    },
  });

  if (!sessao) {
    throw new SessionsServiceError(
      "SESSAO_NAO_ENCONTRADA",
      "Sessão não encontrada.",
    );
  }

  return sessao;
}


// -----------------------------------------------------
// CRIAR SESSÃO
// -----------------------------------------------------

export async function criarSessao(
  idUsuario: string,
  tipoUsuario: string,
  dados: CriarSessaoInput,
) {
  await verificarAcessoCurso(
    dados.idCurso,
    idUsuario,
    tipoUsuario,
  );

  return prisma.sessao.create({
    data: {
      idCurso: dados.idCurso,
      titulo: dados.titulo,
      subtitulo: dados.subtitulo ?? null,
      descricao: dados.descricao?.trim() || null,
      idResponsavel: idUsuario,
    },
    select: {
      id: true,
      idCurso: true,
      titulo: true,
      subtitulo: true,
      descricao: true,
      criadoEm: true,
      atualizadoEm: true,
    },
  });
}

// -----------------------------------------------------
// LISTAR SESSÕES
// -----------------------------------------------------

export async function listarSessoes(
  idCurso: string,
  idUsuario: string,
  tipoUsuario: string,
) {
  await verificarAcessoCurso(
    idCurso,
    idUsuario,
    tipoUsuario,
    "LEITURA",
  );

  return prisma.sessao.findMany({
    where: { idCurso },

    orderBy: [
      { criadoEm: "asc" },
      { id: "asc" },
    ],

    select: {
      id: true,
      idCurso: true,
      titulo: true,
      subtitulo: true,
      descricao: true,
      criadoEm: true,

      _count: {
        select: {
          modulos: true,
        },
      },
    },
  });
}

// -----------------------------------------------------
// CONSULTAR SESSÃO
// -----------------------------------------------------

export async function consultarSessao(
  id: string,
  idUsuario: string,
  tipoUsuario: string,
) {
  await verificarAcessoSessao(
    id,
    idUsuario,
    tipoUsuario,
    "LEITURA",
  );

  return buscarSessao(id);
}

// -----------------------------------------------------
// ATUALIZAR SESSÃO
// -----------------------------------------------------

export async function atualizarSessao(
  id: string,
  idUsuario: string,
  tipoUsuario: string,
  dados: AtualizarSessaoInput,
) {
  await verificarAcessoSessao(
    id,
    idUsuario,
    tipoUsuario,
  );

  return prisma.sessao.update({
    where: { id },
    data: {
      ...(dados.titulo !== undefined && {
        titulo: dados.titulo,
      }),

      ...(dados.subtitulo !== undefined && {
        subtitulo: dados.subtitulo,
      }),

      ...(dados.descricao !== undefined && {
        descricao: dados.descricao?.trim() || null,
      }),
    },
    select: {
      id: true,
      idCurso: true,
      titulo: true,
      subtitulo: true,
      descricao: true,
      criadoEm: true,
      atualizadoEm: true,
    },
  });
}

// -----------------------------------------------------
// EXCLUIR SESSÃO
// -----------------------------------------------------

export async function excluirSessao(
  id: string,
  idUsuario: string,
  tipoUsuario: string,
) {
  await verificarAcessoSessao(
    id,
    idUsuario,
    tipoUsuario,
  );

  await prisma.sessao.delete({
    where: { id },
  });

  return { id };
}