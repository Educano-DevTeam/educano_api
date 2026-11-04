
import bcrypt from "bcryptjs";
import {
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

import { prisma } from "../../../config/prisma.js";
import { enviarEmail } from "../../../services/email.service.js";
import {
  gerarEmailRedefinicaoSenha,
  gerarEmailValidacao,
} from "../templates/validations-email.template.js";
import type {
  RegisterInput,
  ResetPasswordInput,
  VerifyCodeInput,
  TipoUsuarioCadastro,
} from "../schemas/auth.schema.js";
import { emitirToken, verificarToken} from "./token.service.js";
import type { LoginInput } from "../schemas/auth.schema.js";

const CORES_PERFIL = [
  "#425BC2",
  "#86C5FF",
  "#FFA62B",
  "#7DAB9E",
  "#9FBEED",
  "#79B425",
];

const DIAS_VALIDADE_SENHA = 90;

// Intervalo mínimo entre dois envios de código para o mesmo e-mail.
const INTERVALO_REENVIO_SEGUNDOS = 60;

function gerarCodigo(): string {
  const caracteres = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

  return Array.from(
    { length: 6 },
    () => caracteres[randomInt(0, caracteres.length)],
  ).join("");
}

function hashCodigo(codigo: string): string {
  const segredo = process.env.VALIDATION_CODE_SECRET;

  if (!segredo) {
    throw new Error(
      "A variável VALIDATION_CODE_SECRET não foi configurada.",
    );
  }

  return createHmac("sha256", segredo)
    .update(codigo)
    .digest("hex");
}

function compararHashes(hashSalvo: string, hashRecebido: string): boolean {
  const salvo = Buffer.from(hashSalvo, "hex");
  const recebido = Buffer.from(hashRecebido, "hex");

  return salvo.length === recebido.length &&
    timingSafeEqual(salvo, recebido);
}

export class AuthServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}


export async function autorizarTipoCadastro(
  tipoSolicitado: TipoUsuarioCadastro,
  authorization?: string,
): Promise<TipoUsuarioCadastro> {
  // Sem token, somente o cadastro público de aluno é permitido.
  if (!authorization) {
    if (tipoSolicitado !== "ALUNO") {
      throw new AuthServiceError(
        "CADASTRO_NAO_AUTORIZADO",
        "Você não tem autorização para cadastrar usuários.",
      );
    }

    return "ALUNO";
  }

  // Se o cabeçalho foi enviado, ele precisa conter um Bearer token válido.
  if (!authorization.startsWith("Bearer ")) {
    throw new AuthServiceError(
      "TOKEN_INVALIDO",
      "Token inválido ou expirado.",
    );
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    throw new AuthServiceError(
      "TOKEN_INVALIDO",
      "Token inválido ou expirado.",
    );
  }

  let idUsuario: string;

  try {
    idUsuario = verificarToken(token);
  } catch {
    throw new AuthServiceError(
      "TOKEN_INVALIDO",
      "Token inválido ou expirado.",
    );
  }

  // Confirma no banco o tipo e o status atuais do usuário.
  const administrador = await prisma.usuario.findUnique({
    where: { id: idUsuario },
    select: {
      id: true,
      tipo: true,
      status: true,
    },
  });

  if (!administrador || administrador.status !== "ATIVO") {
    throw new AuthServiceError(
      "TOKEN_INVALIDO",
      "Token inválido ou conta indisponível.",
    );
  }

  if (administrador.tipo !== "ADMIN") {
    throw new AuthServiceError(
      "CADASTRO_NAO_AUTORIZADO",
      "Você não tem autorização para cadastrar usuários.",
    );
  }

  // O tipo só é aceito após a confirmação de que o solicitante é ADMIN.
  return tipoSolicitado;
}
export async function registrarUsuario(
  dados: RegisterInput,
  tipoAutorizado: TipoUsuarioCadastro,
) {
  const email = dados.email.toLowerCase();

  const existente = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existente) {
    throw new AuthServiceError(
      "EMAIL_JA_CADASTRADO",
      "Já existe uma conta cadastrada com esse e-mail.",
    );
  }

  const senhaHash = await bcrypt.hash(dados.senha, 12);
  const codigo = gerarCodigo();
  const codigoHash = hashCodigo(codigo);
  const cor = CORES_PERFIL[randomInt(0, CORES_PERFIL.length)];

  // Cria usuário, perfil e código em uma única operação.
  const usuario = await prisma.usuario.create({
    data: {
      nome: dados.nome,
      email,
      senha: senhaHash,
      tipo: tipoAutorizado,
      status: "PENDENTE",

      perfil: {
        create: {
          tipoPerfil: "PRIVADO",
          xp: 0,
          moedas: 0,
          nivel: 0,
          cor,
          urlFotoPerfil: "",
          urlFotoBackground: "",
        },
      },

      codigosValidacao: {
        create: {
          codigo: codigoHash,
          status: "ATIVO",
        },
      },
    },

    select: {
      id: true,
      nome: true,
      email: true,
      tipo: true,
      status: true,
    },
  });

  try {
    // O código bruto só é enviado por e-mail, nunca na resposta da API.
    await enviarEmail({
      destinatario: usuario.email,
      assunto: "Confirme seu e-mail | Educano",
      html: gerarEmailValidacao(usuario.nome, codigo),
    });
  } catch (error) {
    // Evita deixar ativo um código que o usuário não recebeu.
    await prisma.codigoValidacao.updateMany({
      where: {
        idUsuario: usuario.id,
        status: "ATIVO",
      },
      data: { status: "INATIVO" },
    });

    console.error("Falha ao enviar e-mail de validação:", error);

    throw new AuthServiceError(
      "FALHA_ENVIO_EMAIL",
      "Não foi possível enviar o e-mail de confirmação. Tente novamente mais tarde.",
    );
  }

  return usuario;
}

export async function validarCodigo(dados: VerifyCodeInput): Promise<void> {
  const email = dados.email.toLowerCase();
  const codigoRecebido = dados.codigo;

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    select: { id: true, status: true },
  });

  if (!usuario || usuario.status !== "PENDENTE") {
    throw new AuthServiceError(
      "DADOS_INVALIDOS",
      "Não foi possível validar essa conta com os dados informados.",
    );
  }

  const codigoSalvo = await prisma.codigoValidacao.findFirst({
    where: {
      idUsuario: usuario.id,
      status: "ATIVO",
      finalidade: "VALIDACAO_CONTA",
    },
    orderBy: { dataCriacao: "desc" },
  });

  if (!codigoSalvo) {
    throw new AuthServiceError(
      "CODIGO_INEXISTENTE",
      "Não há um código ativo. Solicite um novo código.",
    );
  }

  // Usa o relógio do banco para verificar a expiração.
  const [relogio] = await prisma.$queryRaw<Array<{ agora: Date }>>`
    SELECT CURRENT_TIMESTAMP AS agora
  `;

  if (codigoSalvo.expiraEm <= relogio.agora) {
    await prisma.codigoValidacao.updateMany({
      where: {
        id: codigoSalvo.id,
        status: "ATIVO",
      },
      data: { status: "INATIVO" },
    });

    throw new AuthServiceError(
      "CODIGO_EXPIRADO",
      "O código expirou. Solicite um novo código.",
    );
  }

  const hashRecebido = hashCodigo(codigoRecebido);

  if (!compararHashes(codigoSalvo.codigo, hashRecebido)) {
    throw new AuthServiceError(
      "CODIGO_INCORRETO",
      "Código de validação incorreto.",
    );
  }

  await prisma.$transaction(async (tx) => {
    const [relogioTransacao] = await tx.$queryRaw<
      Array<{ agora: Date }>
    >`
      SELECT CURRENT_TIMESTAMP AS agora
    `;

    // A atualização condicional impede reutilização do código.
    const resultado = await tx.codigoValidacao.updateMany({
      where: {
        id: codigoSalvo.id,
        status: "ATIVO",
        expiraEm: { gt: relogioTransacao.agora },
      },
      data: { status: "USADO" },
    });

    if (resultado.count !== 1) {
      throw new AuthServiceError(
        "CODIGO_EXPIRADO_OU_UTILIZADO",
        "O código expirou ou já foi utilizado. Solicite outro.",
      );
    }

    await tx.usuario.update({
      where: { id: usuario.id },
      data: {
        status: "ATIVO",
        atualizadoEm: relogioTransacao.agora,
      },
    });
  });
}

export async function autenticarUsuario(dados: LoginInput) {
  const email = dados.email.toLowerCase();

  const usuario = await prisma.usuario.findUnique({
    where: { email },
    select: {
      id: true,
      nome: true,
      email: true,
      senha: true,
      tipo: true,
      status: true,
      senhaAtualizadaEm: true,
    },
  });

  // A mesma resposta é usada para credenciais inválidas
  // e contas que ainda não podem acessar o sistema.
  if (!usuario) {
    throw new AuthServiceError(
      "CREDENCIAIS_INVALIDAS",
      "E-mail, senha inválidos ou conta ainda não ativada.",
    );
  }

  const senhaValida = await bcrypt.compare(
    dados.senha,
    usuario.senha,
  );

  if (!senhaValida || usuario.status !== "ATIVO") {
    throw new AuthServiceError(
      "CREDENCIAIS_INVALIDAS",
      "E-mail, senha inválidos ou conta ainda não ativada.",
    );
  }

  // A senha vale por 90 dias; depois disso precisa ser redefinida.
  const validadeSenha = usuario.senhaAtualizadaEm.getTime() +
    DIAS_VALIDADE_SENHA * 24 * 60 * 60 * 1000;

  if (validadeSenha <= Date.now()) {
    throw new AuthServiceError(
      "SENHA_EXPIRADA",
      "Sua senha expirou. Redefina a senha para continuar.",
    );
  }

  const token = emitirToken(usuario.id);

  // Nunca devolvemos o hash da senha na resposta.
  return {
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      tipo: usuario.tipo,
      status: usuario.status,
    },
  };
}

type FinalidadeCodigo = "VALIDACAO_CONTA" | "REDEFINICAO_SENHA";

/**
 * Gera um novo código para a finalidade informada, inativando os anteriores,
 * e envia o código por e-mail.
 */
async function emitirNovoCodigo(
  usuario: { id: string; nome: string; email: string },
  finalidade: FinalidadeCodigo,
) {
  const ultimo = await prisma.codigoValidacao.findFirst({
    where: { idUsuario: usuario.id, finalidade },
    orderBy: { dataCriacao: "desc" },
    select: { dataCriacao: true },
  });

  if (
    ultimo &&
    Date.now() - ultimo.dataCriacao.getTime() <
      INTERVALO_REENVIO_SEGUNDOS * 1000
  ) {
    throw new AuthServiceError(
      "AGUARDE_REENVIO",
      "Aguarde um minuto antes de solicitar um novo código.",
    );
  }

  const codigo = gerarCodigo();

  await prisma.$transaction([
    prisma.codigoValidacao.updateMany({
      where: { idUsuario: usuario.id, status: "ATIVO", finalidade },
      data: { status: "INATIVO" },
    }),
    prisma.codigoValidacao.create({
      data: {
        idUsuario: usuario.id,
        codigo: hashCodigo(codigo),
        status: "ATIVO",
        finalidade,
      },
    }),
  ]);

  try {
    await enviarEmail({
      destinatario: usuario.email,
      assunto: finalidade === "VALIDACAO_CONTA"
        ? "Confirme seu e-mail | Educano"
        : "Redefinição de senha | Educano",
      html: finalidade === "VALIDACAO_CONTA"
        ? gerarEmailValidacao(usuario.nome, codigo)
        : gerarEmailRedefinicaoSenha(usuario.nome, codigo),
    });
  } catch (error) {
    await prisma.codigoValidacao.updateMany({
      where: { idUsuario: usuario.id, status: "ATIVO", finalidade },
      data: { status: "INATIVO" },
    });

    console.error("Falha ao enviar e-mail com código:", error);

    throw new AuthServiceError(
      "FALHA_ENVIO_EMAIL",
      "Não foi possível enviar o e-mail. Tente novamente mais tarde.",
    );
  }
}

export async function reenviarCodigo(email: string): Promise<void> {
  const usuario = await prisma.usuario.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, nome: true, email: true, status: true },
  });

  // A resposta é a mesma quando a conta não existe ou já foi validada,
  // para não revelar quais e-mails estão cadastrados.
  if (!usuario || usuario.status !== "PENDENTE") return;

  await emitirNovoCodigo(usuario, "VALIDACAO_CONTA");
}

export async function solicitarRedefinicaoSenha(
  email: string,
): Promise<void> {
  const usuario = await prisma.usuario.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, nome: true, email: true, status: true },
  });

  if (!usuario || usuario.status !== "ATIVO") return;

  await emitirNovoCodigo(usuario, "REDEFINICAO_SENHA");
}

export async function redefinirSenha(dados: ResetPasswordInput) {
  const usuario = await prisma.usuario.findUnique({
    where: { email: dados.email.toLowerCase() },
    select: { id: true, status: true },
  });

  if (!usuario || usuario.status !== "ATIVO") {
    throw new AuthServiceError(
      "CODIGO_INCORRETO",
      "Código de redefinição incorreto ou expirado.",
    );
  }

  const codigoSalvo = await prisma.codigoValidacao.findFirst({
    where: {
      idUsuario: usuario.id,
      status: "ATIVO",
      finalidade: "REDEFINICAO_SENHA",
    },
    orderBy: { dataCriacao: "desc" },
  });

  if (
    !codigoSalvo ||
    !compararHashes(codigoSalvo.codigo, hashCodigo(dados.codigo))
  ) {
    throw new AuthServiceError(
      "CODIGO_INCORRETO",
      "Código de redefinição incorreto ou expirado.",
    );
  }

  const senhaHash = await bcrypt.hash(dados.novaSenha, 12);

  await prisma.$transaction(async (tx) => {
    const [relogio] = await tx.$queryRaw<Array<{ agora: Date }>>`
      SELECT CURRENT_TIMESTAMP AS agora
    `;

    // A atualização condicional impede reutilização e uso após expirar.
    const resultado = await tx.codigoValidacao.updateMany({
      where: {
        id: codigoSalvo.id,
        status: "ATIVO",
        expiraEm: { gt: relogio.agora },
      },
      data: { status: "USADO" },
    });

    if (resultado.count !== 1) {
      throw new AuthServiceError(
        "CODIGO_EXPIRADO_OU_UTILIZADO",
        "O código expirou ou já foi utilizado. Solicite outro.",
      );
    }

    await tx.usuario.update({
      where: { id: usuario.id },
      data: {
        senha: senhaHash,
        senhaAtualizadaEm: relogio.agora,
        atualizadoEm: relogio.agora,
      },
    });
  });
}

/** Emite um novo token para uma sessão que ainda é válida. */
export function renovarToken(idUsuario: string): string {
  return emitirToken(idUsuario);
}
