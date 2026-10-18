
import type { Request, Response } from "express";
import {
  loginSchema,
  registerSchema,
  verifyCodeSchema,
} from "../schemas/auth.schema.js";
import {
  AuthServiceError,
  autenticarUsuario,
  registrarUsuario,
  validarCodigo,
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
    const usuario = await registrarUsuario(validacao.data);

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