
import bcrypt from "bcryptjs";
import {
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

import { prisma } from "../../../config/prisma.js";
import { enviarEmail } from "../../../services/email.service.js";
import { gerarEmailValidacao } from "../templates/validations-email.template.js";
import type {
  RegisterInput,
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
