import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../config/prisma.js";

import type {
  criarFlashcardSchema,
  atualizarFlashcardSchema,
} from "../schemas/flashcards.schema.js";

import { z } from "zod";

type CriarFlashcardInput = z.infer<typeof criarFlashcardSchema>;
type AtualizarFlashcardInput = z.infer<typeof atualizarFlashcardSchema>;

export class FlashcardsServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "FlashcardsServiceError";
  }
}

// -----------------------------------------------------
// CÁLCULO DO INTERVALO DE REVISÃO
// -----------------------------------------------------

const DIAS_POR_MES = 30;

function calcularProximaVisualizacao(
  dataBase: Date,
  repeticoesMes: number,
) {
  const intervaloMs =
    (DIAS_POR_MES / repeticoesMes) *
    24 * 60 * 60 * 1000;

  return new Date(dataBase.getTime() + intervaloMs);
}

// -----------------------------------------------------
// CRIAR FLASHCARD
// -----------------------------------------------------

export async function criarFlashcard(
  idUsuario: string,
  dados: CriarFlashcardInput,
) {
  const agora = new Date();

  const proximaVisualizacao = calcularProximaVisualizacao(
    agora,
    dados.repeticoesMes,
  );

  return prisma.flashcard.create({
    data: {
      ...dados,
      idUsuario,
      ultimaVisualizacao: null,
      proximaVisualizacao,
    },
  });
}

// -----------------------------------------------------
// LISTAR FLASHCARDS DO USUÁRIO
// -----------------------------------------------------

export async function listarFlashcards(
  idUsuario: string,
  filtros: {
    busca?: string;
    pagina: number;
    limite: number;
  },
) {
  const where: Prisma.FlashcardWhereInput = {
    idUsuario,

    ...(filtros.busca && {
      OR: [
        {
          titulo: {
            contains: filtros.busca,
            mode: "insensitive",
          },
        },
        {
          pergunta: {
            contains: filtros.busca,
            mode: "insensitive",
          },
        },
      ],
    }),
  };

  const [dados, total] = await prisma.$transaction([
    prisma.flashcard.findMany({
      where,

      orderBy: [
        {
          proximaVisualizacao: "asc",
        },
        {
          criadoEm: "desc",
        },
      ],

      skip: (filtros.pagina - 1) * filtros.limite,

      take: filtros.limite,
    }),

    prisma.flashcard.count({
      where,
    }),
  ]);

  return {
    dados,

    paginacao: {
      pagina: filtros.pagina,
      limite: filtros.limite,
      total,
      totalPaginas: Math.ceil(total / filtros.limite),
    },
  };
}

// -----------------------------------------------------
// CONSULTAR FLASHCARD
// -----------------------------------------------------

export async function consultarFlashcard(
  id: string,
  idUsuario: string,
) {
  const flashcard = await prisma.flashcard.findFirst({
    where: {
      id,
      idUsuario,
    },
  });

  if (!flashcard) {
    throw new FlashcardsServiceError(
      "FLASHCARD_NAO_ENCONTRADO",
      "Flashcard não encontrado.",
    );
  }

  return flashcard;
}

// -----------------------------------------------------
// ATUALIZAR FLASHCARD
// -----------------------------------------------------

export async function atualizarFlashcard(
  id: string,
  idUsuario: string,
  dados: AtualizarFlashcardInput,
) {
  return prisma.$transaction(async (tx) => {
    const flashcard = await tx.flashcard.findFirst({
      where: {
        id,
        idUsuario,
      },
    });

    if (!flashcard) {
      throw new FlashcardsServiceError(
        "FLASHCARD_NAO_ENCONTRADO",
        "Flashcard não encontrado.",
      );
    }

    const dadosAtualizacao: Prisma.FlashcardUpdateInput = {
      ...dados,
    };

    // Se a frequência mensal mudar, recalcula a próxima revisão.
    if (dados.repeticoesMes !== undefined) {
      const dataBase =
        flashcard.ultimaVisualizacao ?? flashcard.criadoEm;

      dadosAtualizacao.proximaVisualizacao =
        calcularProximaVisualizacao(
          dataBase,
          dados.repeticoesMes,
        );
    }

    await tx.flashcard.update({
      where: {
        id: flashcard.id,
      },

      data: dadosAtualizacao,
    });

    return tx.flashcard.findUniqueOrThrow({
      where: {
        id: flashcard.id,
      },
    });
  });
}

// -----------------------------------------------------
// EXCLUIR FLASHCARD
// -----------------------------------------------------

export async function excluirFlashcard(
  id: string,
  idUsuario: string,
) {
  const resultado = await prisma.flashcard.deleteMany({
    where: {
      id,
      idUsuario,
    },
  });

  if (resultado.count === 0) {
    throw new FlashcardsServiceError(
      "FLASHCARD_NAO_ENCONTRADO",
      "Flashcard não encontrado.",
    );
  }
}

// -----------------------------------------------------
// VISUALIZAR FLASHCARD
// -----------------------------------------------------

export async function visualizarFlashcard(
  id: string,
  idUsuario: string,
) {
  return prisma.$transaction(async (tx) => {
    const flashcard = await tx.flashcard.findFirst({
      where: {
        id,
        idUsuario,
      },
    });

    if (!flashcard) {
      throw new FlashcardsServiceError(
        "FLASHCARD_NAO_ENCONTRADO",
        "Flashcard não encontrado.",
      );
    }

    const agora = new Date();

    const proximaVisualizacao = calcularProximaVisualizacao(
      agora,
      flashcard.repeticoesMes,
    );

    return tx.flashcard.update({
      where: {
        id: flashcard.id,
      },

      data: {
        ultimaVisualizacao: agora,
        proximaVisualizacao,
      },
    });
  });
}