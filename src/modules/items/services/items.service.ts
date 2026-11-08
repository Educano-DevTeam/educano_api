import { Prisma } from "../../../generated/prisma/client.js";
import { prisma } from "../../../config/prisma.js";

import type {
  criarItemSchema,
  atualizarItemSchema,
} from "../schemas/items.schema.js";

import { z } from "zod";

type CriarItemInput = z.infer<typeof criarItemSchema>;
type AtualizarItemInput = z.infer<typeof atualizarItemSchema>;

export class ItemsServiceError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ItemsServiceError";
  }
}

// -----------------------------------------------------
// VERIFICAÇÃO DE EXPIRAÇÃO
// -----------------------------------------------------

async function atualizarItensExpirados(
  tx: Prisma.TransactionClient,
  idUsuario: string,
) {
  const agora = new Date();

  await (tx as any).inventario.updateMany({
    where: {
      idUsuario,
      status: "ATIVO",
      expiraEm: {
        lte: agora,
      },
    },
    data: {
      status: "USADO",
    },
  });
}

/**
 * Verifica os boosts do usuário e retorna o boost ativo,
 * caso exista. Também atualiza automaticamente os expirados.
 *
 * Esta função é reutilizada pelas rotas e pelas recompensas.
 */
export async function obterBoostAtivo(
  tx: Prisma.TransactionClient,
  idUsuario: string,
) {
  await atualizarItensExpirados(tx, idUsuario);

  return tx.inventario.findFirst({
    where: {
      idUsuario,
      status: "ATIVO",
      expiraEm: {
        gt: new Date(),
      },
      item: {
        categoria: "BOOST",
      },
    },
    include: {
      item: true,
    },
    orderBy: {
      expiraEm: "asc",
    },
  });
}

// -----------------------------------------------------
// CRIAR ITEM
// -----------------------------------------------------

export async function criarItem(
  idResponsavel: string,
  dados: CriarItemInput,
) {
  return prisma.item.create({
    data: {
      ...dados,
      idResponsavel,
    },
  });
}

// -----------------------------------------------------
// LISTAR TODOS OS ITENS - ADMIN
// -----------------------------------------------------

export async function listarItens(params: {
  pagina: number;
  nome?: string;
  categoria?: "BOOST";
  status?: "ATIVO" | "INATIVO";
}) {
  const limite = 30;
  const skip = (params.pagina - 1) * limite;

  const where: Prisma.ItemWhereInput = {
    ...(params.nome && {
      nome: {
        contains: params.nome,
        mode: "insensitive",
      },
    }),
    ...(params.categoria && {
      categoria: params.categoria,
    }),
    ...(params.status && {
      status: params.status,
    }),
  };

  const [dados, total] = await prisma.$transaction([
    prisma.item.findMany({
      where,
      skip,
      take: limite,
      orderBy: {
        criadoEm: "desc",
      },
      include: {
        responsavel: {
          select: {
            id: true,
            nome: true,
          },
        },
      },
    }),
    prisma.item.count({ where }),
  ]);

  return {
    dados,
    paginacao: {
      pagina: params.pagina,
      limite,
      total,
      totalPaginas: Math.ceil(total / limite),
    },
  };
}

// -----------------------------------------------------
// LISTAR LOJA
// -----------------------------------------------------

export async function listarLoja() {
  return prisma.item.findMany({
    where: {
      status: "ATIVO",
    },
    orderBy: {
      preco: "asc",
    },
    select: {
      id: true,
      nome: true,
      descricao: true,
      preco: true,
      categoria: true,
      icone: true,
      boost: true,
      tempoUso: true,
      cor: true,
    },
  });
}

// -----------------------------------------------------
// CONSULTAR ITEM
// -----------------------------------------------------

export async function consultarItem(id: string) {
  const item = await prisma.item.findUnique({
    where: { id },
  });

  if (!item) {
    throw new ItemsServiceError(
      "ITEM_NAO_ENCONTRADO",
      "Item não encontrado.",
    );
  }

  return item;
}

// -----------------------------------------------------
// ATUALIZAR ITEM
// -----------------------------------------------------

export async function atualizarItem(
  id: string,
  dados: AtualizarItemInput,
) {
  const item = await prisma.item.findUnique({
    where: { id },
  });

  if (!item) {
    throw new ItemsServiceError(
      "ITEM_NAO_ENCONTRADO",
      "Item não encontrado.",
    );
  }

  return prisma.item.update({
    where: { id },
    data: dados,
  });
}

// -----------------------------------------------------
// INATIVAR ITEM
// -----------------------------------------------------

export async function inativarItem(id: string) {
  const item = await prisma.item.findUnique({
    where: { id },
  });

  if (!item) {
    throw new ItemsServiceError(
      "ITEM_NAO_ENCONTRADO",
      "Item não encontrado.",
    );
  }

  return prisma.item.update({
    where: { id },
    data: {
      status: "INATIVO",
    },
  });
}

// -----------------------------------------------------
// COMPRAR ITEM
// -----------------------------------------------------

export async function comprarItem(
  idUsuario: string,
  idItem: string,
) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.item.findFirst({
      where: {
        id: idItem,
        status: "ATIVO",
      },
    });

    if (!item) {
      throw new ItemsServiceError(
        "ITEM_NAO_DISPONIVEL",
        "Este item não está disponível na loja.",
      );
    }

    // Atualização condicional: impede saldo negativo
    // mesmo quando duas compras são realizadas simultaneamente.
    const debito = await tx.perfil.updateMany({
      where: {
        idUsuario,
        moedas: {
          gte: item.preco,
        },
      },
      data: {
        moedas: {
          decrement: item.preco,
        },
      },
    });

    if (debito.count === 0) {
      const perfil = await tx.perfil.findUnique({
        where: { idUsuario },
        select: { idUsuario: true },
      });

      if (!perfil) {
        throw new ItemsServiceError(
          "PERFIL_NAO_ENCONTRADO",
          "Perfil do usuário não encontrado.",
        );
      }

      throw new ItemsServiceError(
        "MOEDAS_INSUFICIENTES",
        "Você não possui moedas suficientes para comprar este item.",
      );
    }

    const inventario = await tx.inventario.create({
      data: {
        idUsuario,
        idItem,
      },
      include: {
        item: true,
      },
    });

    return {
      inventario,
      moedasDebitadas: item.preco,
    };
  });
}

// -----------------------------------------------------
// LISTAR INVENTÁRIO
// -----------------------------------------------------

export async function listarInventario(idUsuario: string) {
  return prisma.$transaction(async (tx) => {
    await atualizarItensExpirados(tx, idUsuario);

    return tx.inventario.findMany({
      where: {
        idUsuario,
        status: {
          in: ["NAO_USADO", "ATIVO"],
        },
      },
      include: {
        item: true,
      },
      orderBy: {
        compradoEm: "desc",
      },
    });
  });
}

// -----------------------------------------------------
// ATIVAR ITEM
// -----------------------------------------------------

export async function ativarItem(
  idUsuario: string,
  idInventario: string,
) {
  return prisma.$transaction(
    async (tx) => {
      const inventario = await tx.inventario.findFirst({
        where: {
          id: idInventario,
          idUsuario,
        },
        include: {
          item: true,
        },
      });

      if (!inventario) {
        throw new ItemsServiceError(
          "INVENTARIO_NAO_ENCONTRADO",
          "Item não encontrado no seu inventário.",
        );
      }

      if (inventario.status !== "NAO_USADO") {
        throw new ItemsServiceError(
          "ITEM_NAO_ATIVAVEL",
          "Este item já foi utilizado ou está ativo.",
        );
      }

      // Verifica se existe outro boost ativo.
      const boostAtivo = await obterBoostAtivo(tx, idUsuario);

      if (boostAtivo) {
        throw new ItemsServiceError(
          "BOOST_JA_ATIVO",
          "Você já possui um boost ativo. Aguarde sua expiração.",
        );
      }

      const agora = new Date();

      const expiraEm = new Date(
        agora.getTime() + inventario.item.tempoUso * 60 * 1000,
      );

      const atualizacao = await tx.inventario.updateMany({
        where: {
          id: idInventario,
          idUsuario,
          status: "NAO_USADO",
        },
        data: {
          status: "ATIVO",
          expiraEm,
        },
      });

      if (atualizacao.count === 0) {
        throw new ItemsServiceError(
          "ITEM_NAO_ATIVAVEL",
          "Não foi possível ativar este item.",
        );
      }

      return tx.inventario.findUnique({
        where: {
          id: idInventario,
        },
        include: {
          item: true,
        },
      });
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

// -----------------------------------------------------
// VERIFICAR ITEM DO INVENTÁRIO
// -----------------------------------------------------

export async function verificarItemInventario(
  tx: Prisma.TransactionClient,
  idUsuario: string,
  idInventario: string,
) {
  const inventario = await tx.inventario.findFirst({
    where: {
      id: idInventario,
      idUsuario,
    },
    include: {
      item: true,
    },
  });

  if (!inventario) {
    throw new ItemsServiceError(
      "INVENTARIO_NAO_ENCONTRADO",
      "Item não encontrado no seu inventário.",
    );
  }

  // Reutiliza a mesma regra de expiração.
  await atualizarItensExpirados(tx, idUsuario);

  const atualizado = await tx.inventario.findUnique({
    where: {
      id: idInventario,
    },
    include: {
      item: true,
    },
  });

  if (!atualizado) {
    throw new ItemsServiceError(
      "INVENTARIO_NAO_ENCONTRADO",
      "Item não encontrado.",
    );
  }

  if (atualizado.status === "NAO_USADO") {
    return {
      status: atualizado.status,
      ativo: false,
      mensagem: "Este item ainda não foi ativado.",
      inventario: atualizado,
    };
  }

  if (atualizado.status === "USADO") {
    return {
      status: atualizado.status,
      ativo: false,
      mensagem: "Este item já foi utilizado ou expirou.",
      inventario: atualizado,
    };
  }

  const agora = new Date();
  const expiraEm = atualizado.expiraEm!;

  const restanteMs = Math.max(
    0,
    expiraEm.getTime() - agora.getTime(),
  );

  return {
    status: atualizado.status,
    ativo: true,
    expiraEm,
    tempoRestante: {
      milissegundos: restanteMs,
      segundos: Math.ceil(restanteMs / 1000),
      minutos: Math.ceil(restanteMs / 60000),
    },
    inventario: atualizado,
  };
}