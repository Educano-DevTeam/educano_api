
import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../config/prisma.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ITENS_POR_PAGINA = 30;

export class CourseAccessError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "CourseAccessError";
  }
}

function validarUuid(id: string) {
  if (!UUID_REGEX.test(id)) {
    throw new CourseAccessError("ID_INVALIDO", "Identificador inválido.");
  }
}

async function buscarCurso(idCurso: string) {
  validarUuid(idCurso);

  const curso = await prisma.curso.findUnique({
    where: { id: idCurso },
    select: {
      id: true,
      nome: true,
      status: true,
      vagas: true,
      preco: true,
      idResponsavel: true,
    },
  });

  if (!curso) {
    throw new CourseAccessError(
      "CURSO_NAO_ENCONTRADO",
      "Curso não encontrado.",
    );
  }

  return curso;
}

function exigirResponsavelOuAdmin(
  idResponsavel: string,
  idUsuario: string,
  tipoUsuario: string,
) {
  if (
    tipoUsuario !== "ADMIN" &&
    idResponsavel !== idUsuario
  ) {
    throw new CourseAccessError(
      "SEM_PERMISSAO",
      "Somente o responsável pelo curso ou um administrador pode executar esta ação.",
    );
  }
}

// =====================================================
// INSCRIÇÕES
// =====================================================

/**
 * Inscreve o próprio usuário no curso.
 *
 * Cursos gratuitos: inscrição direta.
 * Cursos pagos: confirmação simulada temporariamente.
 *
 * TODO: substituir a confirmação simulada pela validação
 * real do pagamento quando a integração financeira existir.
 */
export async function inscreverUsuario(
  idCurso: string,
  idUsuario: string,
) {
  validarUuid(idCurso);

  try {
    return await prisma.$transaction(
      async (tx) => {
        const curso = await tx.curso.findUnique({
          where: { id: idCurso },
          select: {
            id: true,
            nome: true,
            status: true,
            vagas: true,
            preco: true,
          },
        });

        if (!curso) {
          throw new CourseAccessError(
            "CURSO_NAO_ENCONTRADO",
            "Curso não encontrado.",
          );
        }

        if (curso.status !== "ATIVO") {
          throw new CourseAccessError(
            "CURSO_NAO_DISPONIVEL",
            "Este curso não está disponível para inscrições.",
          );
        }

        const existente = await tx.inscricao.findUnique({
          where: {
            idUsuario_idCurso: {
              idUsuario,
              idCurso,
            },
          },
          select: { id: true },
        });

        if (existente) {
          throw new CourseAccessError(
            "JA_INSCRITO",
            "Você já está inscrito neste curso.",
          );
        }

        const totalInscritos = await tx.inscricao.count({
          where: { idCurso },
        });

        if (
          curso.vagas !== null &&
          totalInscritos >= curso.vagas
        ) {
          throw new CourseAccessError(
            "VAGAS_ESGOTADAS",
            "Não há mais vagas disponíveis neste curso.",
          );
        }

        // O pagamento de cursos pagos ainda é simulado.
        // A confirmação real deverá ocorrer antes da inscrição
        // quando a integração de pagamentos for implementada.
        const inscricao = await tx.inscricao.create({
          data: {
            idUsuario,
            idCurso,
          },
          select: {
            id: true,
            idUsuario: true,
            idCurso: true,
            criadoEm: true,
          },
        });

        return {
          inscricao,
          curso: {
            id: curso.id,
            nome: curso.nome,
            preco: curso.preco,
          },
          totalInscritos: totalInscritos + 1,
          vagasRestantes:
            curso.vagas === null
              ? null
              : Math.max(0, curso.vagas - totalInscritos - 1),
          pagamentoSimulado:
            curso.preco !== null &&
            Number(curso.preco) > 0,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error) {
    if (error instanceof CourseAccessError) {
      throw error;
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError
    ) {
      if (error.code === "P2002") {
        throw new CourseAccessError(
          "JA_INSCRITO",
          "Você já está inscrito neste curso.",
        );
      }

      if (error.code === "P2034") {
        throw new CourseAccessError(
          "CONCORRENCIA_INSCRICAO",
          "Houve uma disputa pela última vaga. Atualize a página e tente novamente.",
        );
      }
    }

    throw error;
  }
}

/**
 * Consulta a inscrição do próprio usuário.
 */
export async function consultarMinhaInscricao(
  idCurso: string,
  idUsuario: string,
) {
  const curso = await buscarCurso(idCurso);

  const inscricao = await prisma.inscricao.findUnique({
    where: {
      idUsuario_idCurso: {
        idUsuario,
        idCurso,
      },
    },
    select: {
      id: true,
      criadoEm: true,
      curso: {
        select: {
          id: true,
          nome: true,
          status: true,
          preco: true,
          vagas: true,
        },
      },
    },
  });

  return {
    inscrito: Boolean(inscricao),
    inscricao,
    curso: {
      id: curso.id,
      nome: curso.nome,
    },
  };
}

/**
 * Cancela somente a inscrição do próprio usuário.
 */
export async function cancelarMinhaInscricao(
  idCurso: string,
  idUsuario: string,
) {
  await buscarCurso(idCurso);

  const resultado = await prisma.inscricao.deleteMany({
    where: {
      idCurso,
      idUsuario,
    },
  });

  if (resultado.count === 0) {
    throw new CourseAccessError(
      "INSCRICAO_NAO_ENCONTRADA",
      "Você não possui inscrição neste curso.",
    );
  }

  return { idCurso, cancelada: true };
}

/**
 * Lista inscritos. Restrito ao responsável do curso ou ADMIN.
 */
export async function listarInscritos(
  idCurso: string,
  idUsuario: string,
  tipoUsuario: string,
  pagina = 1,
) {
  const curso = await buscarCurso(idCurso);

  exigirResponsavelOuAdmin(
    curso.idResponsavel,
    idUsuario,
    tipoUsuario,
  );

  const [dados, total] = await prisma.$transaction([
    prisma.inscricao.findMany({
      where: { idCurso },
      orderBy: [
        { criadoEm: "desc" },
        { id: "asc" },
      ],
      skip: (pagina - 1) * ITENS_POR_PAGINA,
      take: ITENS_POR_PAGINA,
      select: {
        id: true,
        criadoEm: true,
        usuario: {
          select: {
            id: true,
            nome: true,
            email: true,
            tipo: true,
            status: true,
          },
        },
      },
    }),
    prisma.inscricao.count({
      where: { idCurso },
    }),
  ]);

  const totalPaginas = Math.ceil(total / ITENS_POR_PAGINA);

  return {
    curso: {
      id: curso.id,
      nome: curso.nome,
      vagas: curso.vagas,
    },
    dados,
    paginacao: {
      pagina,
      porPagina: ITENS_POR_PAGINA,
      total,
      totalPaginas,
      temMais: pagina < totalPaginas,
    },
  };
}

// =====================================================
// PROFESSORES VINCULADOS AO CURSO
// =====================================================

/**
 * Lista professores ativos que ainda não estão vinculados
 * ao curso. Somente responsável ou ADMIN.
 */
export async function listarProfessoresDisponiveis(
  idCurso: string,
  idUsuario: string,
  tipoUsuario: string,
  pagina = 1,
) {
  const curso = await buscarCurso(idCurso);

  exigirResponsavelOuAdmin(
    curso.idResponsavel,
    idUsuario,
    tipoUsuario,
  );

  const vinculados = await prisma.cursoProfessor.findMany({
    where: { idCurso },
    select: { idProfessor: true },
  });

  const idsVinculados = vinculados.map(
    (vinculo) => vinculo.idProfessor,
  );

  const where: Prisma.UsuarioWhereInput = {
    tipo: "PROFESSOR",
    status: "ATIVO",
    ...(idsVinculados.length > 0 && {
      id: { notIn: idsVinculados },
    }),
  };

  const [dados, total] = await prisma.$transaction([
    prisma.usuario.findMany({
      where,
      orderBy: [
        { nome: "asc" },
        { id: "asc" },
      ],
      skip: (pagina - 1) * ITENS_POR_PAGINA,
      take: ITENS_POR_PAGINA,
      select: {
        id: true,
        nome: true,
        email: true,
      },
    }),
    prisma.usuario.count({ where }),
  ]);

  return {
    dados,
    paginacao: {
      pagina,
      porPagina: ITENS_POR_PAGINA,
      total,
      totalPaginas: Math.ceil(total / ITENS_POR_PAGINA),
    },
  };
}

/**
 * Lista os professores atualmente vinculados ao curso.
 */
export async function listarProfessoresVinculados(
  idCurso: string,
  idUsuario: string,
  tipoUsuario: string,
) {
  const curso = await buscarCurso(idCurso);

  exigirResponsavelOuAdmin(
    curso.idResponsavel,
    idUsuario,
    tipoUsuario,
  );

  return prisma.cursoProfessor.findMany({
    where: { idCurso },
    orderBy: [
      { criadoEm: "asc" },
      { id: "asc" },
    ],
    select: {
      id: true,
      criadoEm: true,
      professor: {
        select: {
          id: true,
          nome: true,
          email: true,
          status: true,
        },
      },
      responsavelVinculo: {
        select: {
          id: true,
          nome: true,
        },
      },
    },
  });
}

/**
 * Vincula um professor ativo ao curso.
 */
export async function vincularProfessor(
  idCurso: string,
  idProfessor: string,
  idUsuario: string,
  tipoUsuario: string,
) {
  const curso = await buscarCurso(idCurso);

  exigirResponsavelOuAdmin(
    curso.idResponsavel,
    idUsuario,
    tipoUsuario,
  );

  validarUuid(idProfessor);

  const professor = await prisma.usuario.findUnique({
    where: { id: idProfessor },
    select: {
      id: true,
      nome: true,
      tipo: true,
      status: true,
    },
  });

  if (
    !professor ||
    professor.tipo !== "PROFESSOR" ||
    professor.status !== "ATIVO"
  ) {
    throw new CourseAccessError(
      "PROFESSOR_INVALIDO",
      "O usuário informado não é um professor ativo.",
    );
  }

  try {
    return await prisma.cursoProfessor.create({
      data: {
        idCurso,
        idProfessor,
        idResponsavelVinculo: idUsuario,
      },
      select: {
        id: true,
        idCurso: true,
        idProfessor: true,
        idResponsavelVinculo: true,
        criadoEm: true,
        professor: {
          select: {
            id: true,
            nome: true,
            email: true,
          },
        },
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new CourseAccessError(
        "PROFESSOR_JA_VINCULADO",
        "Este professor já está vinculado ao curso.",
      );
    }

    throw error;
  }
}

/**
 * Remove o vínculo de um professor com o curso.
 * Não exclui a conta do professor.
 */
export async function desvincularProfessor(
  idCurso: string,
  idProfessor: string,
  idUsuario: string,
  tipoUsuario: string,
) {
  const curso = await buscarCurso(idCurso);

  exigirResponsavelOuAdmin(
    curso.idResponsavel,
    idUsuario,
    tipoUsuario,
  );

  validarUuid(idProfessor);

  const resultado = await prisma.cursoProfessor.deleteMany({
    where: {
      idCurso,
      idProfessor,
    },
  });

  if (resultado.count === 0) {
    throw new CourseAccessError(
      "VINCULO_NAO_ENCONTRADO",
      "Este professor não está vinculado ao curso.",
    );
  }

  return {
    idCurso,
    idProfessor,
    desvinculado: true,
  };
}
