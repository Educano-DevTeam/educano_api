
import bcrypt from "bcryptjs";
import { prisma } from "../../../config/prisma.js";
import { excluirArquivo } from "../../files/services/files.service.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type {
  AlterarSenhaInput,
  EditarUsuarioInput,
  ListarUsuariosQuery,
} from "../schemas/users.schema.js";

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

export async function listarUsuarios(filtros: ListarUsuariosQuery) {
  const page = filtros.page;
  const skip = (page - 1) * USUARIOS_POR_PAGINA;

  const where: Prisma.UsuarioWhereInput = {
    ...(filtros.tipo && { tipo: filtros.tipo }),
    ...(filtros.status && { status: filtros.status }),
    ...(filtros.busca && {
      OR: [
        { nome: { contains: filtros.busca, mode: "insensitive" } },
        { email: { contains: filtros.busca, mode: "insensitive" } },
      ],
    }),
  };

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

  // Simulados gerados para o usuário e fotos de perfil pertencem só a ele.
  const fotos = await prisma.arquivo.findMany({
    where: {
      idOrigem: usuario.id,
      finalidade: { in: ["FOTO_PERFIL", "BACKGROUND_PERFIL"] },
    },
    select: { id: true },
  });

  for (const foto of fotos) {
    await excluirArquivo(foto.id).catch(() => undefined);
  }

  try {
    await prisma.$transaction([
      prisma.teste.deleteMany({
        where: { idResponsavel: usuario.id, tipo: "SIMULADO", idModulo: null },
      }),
      // As relações configuradas no schema excluem perfil e códigos associados.
      prisma.usuario.delete({ where: { id: usuario.id } }),
    ]);
  } catch (error) {
    // Cursos, aulas e questões criados pelo usuário impedem a exclusão.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2003"
    ) {
      throw new UsersServiceError(
        "CONTEUDO_VINCULADO",
        "O usuário é responsável por cursos ou questões. Transfira ou exclua esse conteúdo antes.",
      );
    }

    throw error;
  }

  return { id: usuario.id };
}

const camposUsuario = {
  id: true,
  nome: true,
  email: true,
  tipo: true,
  status: true,
  criadoEm: true,
  atualizadoEm: true,
} as const;

export async function alterarStatusUsuario(
  identifier: string,
  status: "ATIVO" | "INATIVO",
  idSolicitante: string,
) {
  const usuario = await consultarUsuario(identifier);

  if (usuario.id === idSolicitante) {
    throw new UsersServiceError(
      "OPERACAO_NAO_PERMITIDA",
      "Você não pode alterar o status da sua própria conta.",
    );
  }

  // Contas pendentes só são ativadas pela validação do e-mail.
  if (usuario.status === "PENDENTE" && status === "ATIVO") {
    throw new UsersServiceError(
      "OPERACAO_NAO_PERMITIDA",
      "A conta ainda não validou o e-mail e não pode ser ativada manualmente.",
    );
  }

  return prisma.usuario.update({
    where: { id: usuario.id },
    data: { status, atualizadoEm: new Date() },
    select: camposUsuario,
  });
}

export async function editarMeuUsuario(id: string, nome: string) {
  return prisma.usuario.update({
    where: { id },
    data: { nome, atualizadoEm: new Date() },
    select: camposUsuario,
  });
}

export async function alterarSenha(id: string, dados: AlterarSenhaInput) {
  const usuario = await prisma.usuario.findUnique({
    where: { id },
    select: { senha: true },
  });

  if (!usuario) {
    throw new UsersServiceError(
      "USUARIO_NAO_ENCONTRADO",
      "Usuário não encontrado.",
    );
  }

  const senhaValida = await bcrypt.compare(dados.senhaAtual, usuario.senha);

  if (!senhaValida) {
    throw new UsersServiceError(
      "SENHA_INCORRETA",
      "A senha atual está incorreta.",
    );
  }

  if (dados.senhaAtual === dados.novaSenha) {
    throw new UsersServiceError(
      "DADOS_INVALIDOS",
      "A nova senha deve ser diferente da atual.",
    );
  }

  const agora = new Date();

  await prisma.usuario.update({
    where: { id },
    data: {
      senha: await bcrypt.hash(dados.novaSenha, 12),
      senhaAtualizadaEm: agora,
      atualizadoEm: agora,
    },
  });
}
