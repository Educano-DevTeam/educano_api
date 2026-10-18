import { prisma } from "../../../config/prisma.js";

const POR_PAGINA = 15;

export async function consultarRanking(page: number) {
  const skip = (page - 1) * POR_PAGINA;

  const [usuarios, total] = await prisma.$transaction([
    prisma.usuario.findMany({
      // O ranking considera apenas contas ativas que possuem perfil.
      where: {
        status: "ATIVO",
        perfil: {
          isNot: null,
        },
      },

      // Maior XP primeiro; o ID desempata posições.
      orderBy: [
        { perfil: { xp: "desc" } },
        { id: "asc" },
      ],

      skip,
      take: POR_PAGINA,

      // Retorna apenas os dados necessários para o ranking.
      select: {
        id: true,
        nome: true,
        perfil: {
          select: {
            xp: true,
            nivel: true,
            urlFotoPerfil: true,
          },
        },
      },
    }),

    prisma.usuario.count({
      where: {
        status: "ATIVO",
        perfil: {
          isNot: null,
        },
      },
    }),
  ]);

  return {
    dados: usuarios.map((usuario, index) => ({
      posicao: skip + index + 1,
      id: usuario.id,
      nome: usuario.nome,
      xp: usuario.perfil?.xp ?? 0,
      nivel: usuario.perfil?.nivel ?? 0,
      urlFotoPerfil: usuario.perfil?.urlFotoPerfil ?? "",
    })),

    paginacao: {
      pagina: page,
      porPagina: POR_PAGINA,
      total,
      temMais: skip + usuarios.length < total,
      proximaPagina:
        skip + usuarios.length < total ? page + 1 : null,
    },
  };
}