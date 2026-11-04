import { prisma } from "../../../config/prisma.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { ErroServico, conflito, naoEncontrado } from "../../../shared/erros.js";
import { ehAdmin, type UsuarioAutenticado } from "../../../shared/usuario.js";
import type { ListarItensQuery, SalvarItemInput } from "../schemas/store.schema.js";

// Itens que são gastos ao serem ativados.
const EFEITOS_CONSUMIVEIS = ["BOOST_XP", "ESCUDO_SEQUENCIA", "TEMPO_EXTRA", "REVIVER_TENTATIVA"];

const selecaoItem = {
  id: true,
  nome: true,
  descricao: true,
  preco: true,
  icone: true,
  cor: true,
  categoria: true,
  efeito: true,
  valorEfeito: true,
  duracaoMinutos: true,
  ativo: true,
  criadoEm: true,
} satisfies Prisma.ItemSelect;

/** Marca como expirados os itens cujo tempo de uso terminou. */
export async function expirarItens(): Promise<number> {
  const resultado = await prisma.ativacaoItem.updateMany({
    where: { status: "ATIVO", expiraEm: { lte: new Date() } },
    data: { status: "EXPIRADO" },
  });

  return resultado.count;
}

async function saldo(idUsuario: string): Promise<number> {
  const perfil = await prisma.perfil.findUnique({
    where: { idUsuario },
    select: { moedas: true },
  });

  return perfil?.moedas ?? 0;
}

export async function listarItens(
  usuario: UsuarioAutenticado,
  filtros: ListarItensQuery,
) {
  const incluirInativos = filtros.todos === "true" && ehAdmin(usuario);

  const where: Prisma.ItemWhereInput = {
    ...(!incluirInativos && { ativo: true }),
    ...(filtros.categoria && {
      categoria: { equals: filtros.categoria, mode: "insensitive" },
    }),
    ...(filtros.busca && {
      nome: { contains: filtros.busca, mode: "insensitive" },
    }),
  };

  const [itens, inventario, categorias] = await Promise.all([
    prisma.item.findMany({
      where,
      orderBy: [{ categoria: "asc" }, { preco: "asc" }],
      select: selecaoItem,
    }),
    prisma.inventarioItem.findMany({
      where: { idUsuario: usuario.id },
      select: { idItem: true, quantidade: true },
    }),
    prisma.item.findMany({
      where: incluirInativos ? {} : { ativo: true },
      distinct: ["categoria"],
      orderBy: { categoria: "asc" },
      select: { categoria: true },
    }),
  ]);

  const quantidades = new Map(inventario.map((i) => [i.idItem, i.quantidade]));

  return {
    saldo: await saldo(usuario.id),
    categorias: categorias.map((c) => c.categoria),
    dados: itens.map((item) => ({
      ...item,
      quantidadeNoInventario: quantidades.get(item.id) ?? 0,
    })),
  };
}

export async function criarItem(dados: SalvarItemInput) {
  return prisma.item.create({ data: dados, select: selecaoItem });
}

export async function atualizarItem(id: string, dados: SalvarItemInput) {
  const existe = await prisma.item.findUnique({ where: { id }, select: { id: true } });

  if (!existe) throw naoEncontrado("Item não encontrado.");

  return prisma.item.update({ where: { id }, data: dados, select: selecaoItem });
}

export async function excluirItem(id: string) {
  const existe = await prisma.item.findUnique({ where: { id }, select: { id: true } });

  if (!existe) throw naoEncontrado("Item não encontrado.");

  // Itens já comprados são apenas retirados da loja para preservar inventários.
  const comprados = await prisma.inventarioItem.count({ where: { idItem: id } });

  if (comprados > 0) {
    await prisma.item.update({ where: { id }, data: { ativo: false } });
    return { removido: false, desativado: true };
  }

  await prisma.item.delete({ where: { id } });
  return { removido: true, desativado: false };
}

export async function comprarItem(
  usuario: UsuarioAutenticado,
  idItem: string,
  quantidade: number,
) {
  return prisma.$transaction(async (tx) => {
    const item = await tx.item.findUnique({
      where: { id: idItem },
      select: { id: true, nome: true, preco: true, ativo: true, efeito: true },
    });

    if (!item || !item.ativo) throw naoEncontrado("Item indisponível na loja.");

    if (item.efeito === "COSMETICO") {
      const possui = await tx.inventarioItem.findUnique({
        where: { idUsuario_idItem: { idUsuario: usuario.id, idItem } },
        select: { quantidade: true },
      });

      if ((possui?.quantidade ?? 0) > 0 || quantidade > 1) {
        throw conflito("Itens de personalização só podem ser comprados uma vez.");
      }
    }

    const total = item.preco * quantidade;

    // Débito condicional: falha se o saldo mudou e ficou insuficiente.
    const debito = await tx.perfil.updateMany({
      where: { idUsuario: usuario.id, moedas: { gte: total } },
      data: { moedas: { decrement: total } },
    });

    if (debito.count !== 1) {
      throw new ErroServico(
        400,
        "SALDO_INSUFICIENTE",
        `Saldo insuficiente. ${item.nome} custa ${total} moedas.`,
      );
    }

    await tx.movimentacaoRecompensa.create({
      data: {
        idUsuario: usuario.id,
        origem: "COMPRA",
        referencia: item.id,
        moedas: -total,
      },
    });

    const inventario = await tx.inventarioItem.upsert({
      where: { idUsuario_idItem: { idUsuario: usuario.id, idItem } },
      create: { idUsuario: usuario.id, idItem, quantidade },
      update: { quantidade: { increment: quantidade } },
      select: { quantidade: true },
    });

    const perfil = await tx.perfil.findUniqueOrThrow({
      where: { idUsuario: usuario.id },
      select: { moedas: true },
    });

    return {
      item: { id: item.id, nome: item.nome },
      quantidade: inventario.quantidade,
      saldo: perfil.moedas,
    };
  });
}

export async function consultarInventario(usuario: UsuarioAutenticado) {
  await expirarItens();

  const [inventario, ativacoes] = await Promise.all([
    prisma.inventarioItem.findMany({
      where: { idUsuario: usuario.id },
      orderBy: { item: { nome: "asc" } },
      select: { quantidade: true, item: { select: selecaoItem } },
    }),
    prisma.ativacaoItem.findMany({
      where: { idUsuario: usuario.id, status: "ATIVO" },
      orderBy: { ativadoEm: "desc" },
      select: { id: true, idItem: true, ativadoEm: true, expiraEm: true },
    }),
  ]);

  const agora = Date.now();

  return {
    saldo: await saldo(usuario.id),
    dados: inventario
      .filter(
        (registro) =>
          registro.quantidade > 0 || ativacoes.some((a) => a.idItem === registro.item.id),
      )
      .map((registro) => {
        const ativacao = ativacoes.find((a) => a.idItem === registro.item.id);

        return {
          item: registro.item,
          quantidade: registro.quantidade,
          ativo: Boolean(ativacao),
          ativacao: ativacao
            ? {
                id: ativacao.id,
                ativadoEm: ativacao.ativadoEm,
                expiraEm: ativacao.expiraEm,
                segundosRestantes: ativacao.expiraEm
                  ? Math.max(0, Math.floor((ativacao.expiraEm.getTime() - agora) / 1000))
                  : null,
              }
            : null,
        };
      }),
  };
}

export async function ativarItem(usuario: UsuarioAutenticado, idItem: string) {
  await expirarItens();

  await prisma.$transaction(async (tx) => {
    const registro = await tx.inventarioItem.findUnique({
      where: { idUsuario_idItem: { idUsuario: usuario.id, idItem } },
      select: {
        quantidade: true,
        item: { select: { id: true, nome: true, efeito: true, duracaoMinutos: true } },
      },
    });

    if (!registro || registro.quantidade <= 0) {
      throw naoEncontrado("Você não possui este item no inventário.");
    }

    const { item } = registro;

    if (item.efeito === "DICA_EXTRA") {
      throw new ErroServico(
        400,
        "USO_NO_SIMULADO",
        "A Dica Extra é usada durante um simulado, na questão desejada.",
      );
    }

    const ativa = await tx.ativacaoItem.findFirst({
      where: { idUsuario: usuario.id, idItem, status: "ATIVO" },
      select: { id: true },
    });

    if (ativa) {
      throw conflito(
        item.efeito === "TEMPO_EXTRA"
          ? "Você já tem um Tempo Extra aguardando o próximo simulado."
          : `${item.nome} já está ativo.`,
      );
    }

    if (item.efeito === "COSMETICO") {
      // Só uma personalização fica em uso por vez.
      await tx.ativacaoItem.updateMany({
        where: { idUsuario: usuario.id, status: "ATIVO", item: { efeito: "COSMETICO" } },
        data: { status: "EXPIRADO" },
      });
      await tx.perfil.update({
        where: { idUsuario: usuario.id },
        data: { decoracaoId: item.id },
      });
    }

    if (EFEITOS_CONSUMIVEIS.includes(item.efeito)) {
      await tx.inventarioItem.update({
        where: { idUsuario_idItem: { idUsuario: usuario.id, idItem } },
        data: { quantidade: { decrement: 1 } },
      });
    }

    // Tempo Extra não expira: é consumido ao iniciar o próximo simulado.
    const expiraEm = item.duracaoMinutos && item.efeito !== "TEMPO_EXTRA"
      ? new Date(Date.now() + item.duracaoMinutos * 60 * 1000)
      : null;

    await tx.ativacaoItem.create({
      data: { idUsuario: usuario.id, idItem, status: "ATIVO", expiraEm },
    });
  });

  return consultarInventario(usuario);
}
