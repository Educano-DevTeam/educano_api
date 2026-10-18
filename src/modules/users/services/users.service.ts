
import { prisma } from "../../../config/prisma.js";
import type { EditarUsuarioInput } from "../schemas/users.schema.js";

export class UsersServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "UsersServiceError";
  }
}

function localizarUsuario(identifier: string) {
  // O formato do identificador determina qual campo será consultado.
  if (identifier.includes("@")) {
    return prisma.usuario.findUnique({
      where: { email: identifier.toLowerCase() },
      select: {
        id: true,
        nome: true,
        email: true,
        tipo: true,
        status: true,
        criadoEm: true,
        atualizadoEm: true,
      },
    });
  }

  // O id do schema é UUID. Um valor inválido não deve chegar ao Prisma.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier)) {
    throw new UsersServiceError(
      "IDENTIFICADOR_INVALIDO",
      "Informe um UUID válido ou um e-mail.",
    );
  }

  return prisma.usuario.findUnique({
    where: { id: identifier },
    select: {
      id: true,
      nome: true,
      email: true,
      tipo: true,
      status: true,
      criadoEm: true,
      atualizadoEm: true,
    },
  });
}

export async function consultarUsuario(identifier: string) {
  const usuario = await localizarUsuario(identifier);

  if (!usuario) {
    throw new UsersServiceError(
      "USUARIO_NAO_ENCONTRADO",
      "Usuário não encontrado.",
    );
  }

  return usuario;
}

const USUARIOS_POR_PAGINA = 30;

export async function listarUsuarios(page: number) {
  const skip = (page - 1) * USUARIOS_POR_PAGINA;

  const where = {};

  const [usuarios, total] = await prisma.$transaction([
    prisma.usuario.findMany({
      where,
      skip,
      take: USUARIOS_POR_PAGINA,

      // Ordem estável para a paginação.
      orderBy: [
        { criadoEm: "desc" },
        { id: "asc" },
      ],

      // Inclui o perfil relacionado sem precisar juntar
      // manualmente os resultados de duas consultas.
      select: {
        id: true,
        nome: true,
        email: true,
        tipo: true,
        status: true,
        criadoEm: true,
        atualizadoEm: true,

        perfil: {
          select: {
            tipoPerfil: true,
            planoContaId: true,
            xp: true,
            moedas: true,
            nivel: true,
            cor: true,
            decoracaoId: true,
            urlFotoPerfil: true,
            urlFotoBackground: true,
          },
        },
      },
    }),

    prisma.usuario.count({ where }),
  ]);

  const totalPaginas = Math.ceil(total / USUARIOS_POR_PAGINA);

  return {
    dados: usuarios,
    paginacao: {
      pagina: page,
      porPagina: USUARIOS_POR_PAGINA,
      total,
      totalPaginas,
      temMais: page < totalPaginas,
      proximaPagina: page < totalPaginas ? page + 1 : null,
    },
  };
}

export async function editarUsuario(
  identifier: string,
  dados: EditarUsuarioInput,
) {
  // Verifica a existência e valida o identificador antes de atualizar.
  const usuario = await consultarUsuario(identifier);

  try {
    return await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        ...(dados.nome !== undefined && { nome: dados.nome }),
        ...(dados.email !== undefined && {
          email: dados.email.toLowerCase(),
        }),
        atualizadoEm: new Date(),
      },
      select: {
        id: true,
        nome: true,
        email: true,
        tipo: true,
        status: true,
        criadoEm: true,
        atualizadoEm: true,
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2002"
    ) {
      throw new UsersServiceError(
        "EMAIL_JA_CADASTRADO",
        "Esse e-mail já está sendo utilizado.",
      );
    }

    throw error;
  }
}

export async function excluirUsuario(identifier: string) {
  const usuario = await consultarUsuario(identifier);

  // As relações configuradas no schema excluem perfil e códigos associados.
  await prisma.usuario.delete({
    where: { id: usuario.id },
  });

  return { id: usuario.id };
}
