
import type { Request, Response } from "express";
import {
  loginSchema,
  registerSchema,
  verifyCodeSchema,
  solicitarRecuperacaoSenhaSchema,
  redefinirSenhaSchema,
  refreshTokenSchema,
  logoutSchema,
} from "../schemas/auth.schema.js";
import {
  AuthServiceError,
  autenticarUsuario,
  autorizarTipoCadastro,
  registrarUsuario,
  validarCodigo,
  solicitarRecuperacaoSenha,
  redefinirSenha,
  renovarSessao,
  encerrarSessao,
} from "../services/auth.service.js";

function responderErro(res: Response, error: unknown) {
  if (error instanceof AuthServiceError) {
    const statusPorCodigo: Record<string, number> = {
      EMAIL_JA_CADASTRADO: 409,
      FALHA_ENVIO_EMAIL: 503,
      DADOS_INVALIDOS: 400,
      CODIGO_INEXISTENTE: 400,
      CODIGO_EXPIRADO: 400,
      CODIGO_INCORRETO: 400,
      CODIGO_EXPIRADO_OU_UTILIZADO: 400,
      CREDENCIAIS_INVALIDAS: 401,
      TOKEN_INVALIDO: 401,
      SESSAO_INVALIDA: 401,
      CADASTRO_NAO_AUTORIZADO: 403,
    };

    return res.status(statusPorCodigo[error.code] ?? 400).json({
      message: error.message,
    });
  }

  // Trata uma possível colisão de e-mail em cadastros simultâneos.
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    return res.status(409).json({
      message: "Já existe uma conta cadastrada com esse e-mail.",
    });
  }

  console.error("Erro no módulo de autenticação:", error);

  return res.status(500).json({
    message: "Não foi possível concluir a solicitação.",
  });
}


export async function registrar(req: Request, res: Response) {
  const validacao = registerSchema.safeParse(req.body);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Os dados do cadastro são inválidos.",
      errors: validacao.error.issues,
    });
  }

  try {
    // Primeiro autoriza o tipo solicitado.
    const tipoAutorizado = await autorizarTipoCadastro(
      req.body.tipo,
      req.get("authorization"),
    );

    // Só depois da autorização cria a conta.
    const usuario = await registrarUsuario(
      validacao.data,
      tipoAutorizado,
    );

    return res.status(201).json({
      message: "Cadastro criado. Enviamos um código para seu e-mail.",
      usuario,
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function verificarCodigo(req: Request, res: Response) {
  const validacao = verifyCodeSchema.safeParse(req.body);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Informe um e-mail válido e um código de seis caracteres.",
      errors: validacao.error.issues,
    });
  }

  try {
    await validarCodigo(validacao.data);

    return res.status(200).json({
      message: "Conta validada e ativada com sucesso.",
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function login(req: Request, res: Response) {
  const validacao = loginSchema.safeParse(req.body);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Informe um e-mail válido e uma senha.",
      errors: validacao.error.issues,
    });
  }

  try {
    const resultado = await autenticarUsuario(validacao.data);

    return res.status(200).json({
      message: "Login realizado com sucesso.",
      ...resultado,
    });
  } catch (error) {
    return responderErro(res, error);
  }
}


/**
 * POST /api/auth/forgot-password
 *
 * Envia um código de recuperação para o e-mail informado.
 */
export async function solicitarCodigoRecuperacao(
  req: Request,
  res: Response,
) {
  const validacao = solicitarRecuperacaoSenhaSchema.safeParse(req.body);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Informe um endereço de e-mail válido.",
      errors: validacao.error.issues,
    });
  }

  try {
    await solicitarRecuperacaoSenha(validacao.data);

    return res.status(200).json({
      message:
        "Se o e-mail estiver cadastrado, você receberá um código de recuperação.",
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

/**
 * POST /api/auth/reset-password
 *
 * Valida o código e redefine a senha.
 */
export async function redefinirSenhaUsuario(
  req: Request,
  res: Response,
) {
  const validacao = redefinirSenhaSchema.safeParse(req.body);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Os dados para redefinição de senha são inválidos.",
      errors: validacao.error.issues,
    });
  }

  try {
    await redefinirSenha(validacao.data);

    return res.status(200).json({
      message: "Senha redefinida com sucesso. Você já pode fazer login.",
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

/**
 * POST /api/auth/refresh
 *
 * Renova o access token utilizando um refresh token válido.
 */
export async function refresh(req: Request, res: Response) {
  const validacao = refreshTokenSchema.safeParse(req.body);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Refresh token não informado ou inválido.",
      errors: validacao.error.issues,
    });
  }

  try {
    const resultado = await renovarSessao(
      validacao.data.refreshToken,
    );

    return res.status(200).json({
      message: "Sessão renovada com sucesso.",
      ...resultado,
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

/**
 * POST /api/auth/logout
 *
 * Revoga a sessão associada ao refresh token.
 */
export async function logout(req: Request, res: Response) {
  const validacao = logoutSchema.safeParse(req.body);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Refresh token não informado ou inválido.",
      errors: validacao.error.issues,
    });
  }

  try {
    await encerrarSessao(validacao.data.refreshToken);

    return res.status(200).json({
      message: "Logout realizado com sucesso.",
    });
  } catch (error) {
    return responderErro(res, error);
  }
}