import { prisma } from "../../../config/prisma.js";

import type {
  CriarModuloInput,
  AtualizarModuloInput,
} from "../types/modules.types.js";
const uuidValido = (id: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

export class CourseModulesServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CourseModulesServiceError";
  }
}

function validarUuid(id: string) {
  if (!uuidValido(id)) {
    throw new CourseModulesServiceError(
      "ID_INVALIDO",
      "Identificador inválido.",
    );
  }
}

function verificarPermissao(tipoUsuario: string) {
  if (!["PROFESSOR", "PARCEIRO"].includes(tipoUsuario)) {
    throw new CourseModulesServiceError(
      "SEM_PERMISSAO",
      "Somente professores e parceiros podem administrar módulos.",
    );
  }
}

async function buscarModulo(id: string) {
  validarUuid(id);

  const modulo = await prisma.modulo.findUnique({
    where: { id },
    select: {
      id: true,
      idSessao: true,
      titulo: true,
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
          aulas: true,
          testes: true,
        },
      },

      sessao: {
        select: {
          id: true,
          idCurso: true,
          titulo: true,
        },
      },
    },
  });

  if (!modulo) {
    throw new CourseModulesServiceError(
      "MODULO_NAO_ENCONTRADO",
      "Módulo não encontrado.",
    );
  }

  return modulo;
}

async function verificarAcessoSessao(
  idSessao: string,
  idUsuario: string,
  tipoUsuario: string,
) {
  validarUuid(idSessao);
  verificarPermissao(tipoUsuario);

  const sessao = await prisma.sessao.findUnique({
    where: { id: idSessao },
    select: {
      id: true,
      idCurso: true,
      curso: {
        select: {
          idResponsavel: true,
        },
      },
    },
  });

  if (!sessao) {
    throw new CourseModulesServiceError(
      "SESSAO_NAO_ENCONTRADA",
      "Sessão não encontrada.",
    );
  }

  if (
    tipoUsuario === "PARCEIRO" &&
    sessao.curso.idResponsavel !== idUsuario
  ) {
    throw new CourseModulesServiceError(
      "SEM_PERMISSAO",
      "Você não é o responsável pelo curso desta sessão.",
    );
  }
}

async function verificarAcessoModulo(
  id: string,
  idUsuario: string,
  tipoUsuario: string,
) {
  const modulo = await buscarModulo(id);

  await verificarAcessoSessao(
    modulo.idSessao,
    idUsuario,
    tipoUsuario,
  );

  return modulo;
}

// -----------------------------------------------------
// CRIAR MÓDULO
// -----------------------------------------------------

export async function criarModulo(
  idUsuario: string,
  tipoUsuario: string,
  dados: CriarModuloInput,
) {
  await verificarAcessoSessao(
    dados.idSessao,
    idUsuario,
    tipoUsuario,
  );

  return prisma.modulo.create({
    data: {
      idSessao: dados.idSessao,
      titulo: dados.titulo,
      descricao: dados.descricao?.trim() || null,
      idResponsavel: idUsuario,
    },
    select: {
      id: true,
      idSessao: true,
      titulo: true,
      descricao: true,
      criadoEm: true,
      atualizadoEm: true,
    },
  });
}

// -----------------------------------------------------
// LISTAR MÓDULOS
// -----------------------------------------------------

export async function listarModulos(
  idSessao: string,
  idUsuario: string,
  tipoUsuario: string,
) {
  await verificarAcessoSessao(
    idSessao,
    idUsuario,
    tipoUsuario,
  );

  return prisma.modulo.findMany({
    where: { idSessao },

    orderBy: [
      { criadoEm: "asc" },
      { id: "asc" },
    ],

    select: {
      id: true,
      idSessao: true,
      titulo: true,
      descricao: true,
      criadoEm: true,

      _count: {
        select: {
          aulas: true,
          testes: true,
        },
      },
    },
  });
}

// -----------------------------------------------------
// CONSULTAR MÓDULO
// -----------------------------------------------------

export async function consultarModulo(
  id: string,
  idUsuario: string,
  tipoUsuario: string,
) {
  await verificarAcessoModulo(
    id,
    idUsuario,
    tipoUsuario,
  );

  return buscarModulo(id);
}

// -----------------------------------------------------
// ATUALIZAR MÓDULO
// -----------------------------------------------------

export async function atualizarModulo(
  id: string,
  idUsuario: string,
  tipoUsuario: string,
  dados: AtualizarModuloInput,
) {
  await verificarAcessoModulo(
    id,
    idUsuario,
    tipoUsuario,
  );

  return prisma.modulo.update({
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
      idSessao: true,
      titulo: true,
      descricao: true,
      criadoEm: true,
      atualizadoEm: true,
    },
  });
}

// -----------------------------------------------------
// EXCLUIR MÓDULO
// -----------------------------------------------------

export async function excluirModulo(
  id: string,
  idUsuario: string,
  tipoUsuario: string,
) {
  await verificarAcessoModulo(
    id,
    idUsuario,
    tipoUsuario,
  );

  await prisma.modulo.delete({
    where: { id },
  });

  return { id };
}