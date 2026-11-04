
import type { Request, Response } from "express";
import {
  emailSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyCodeSchema,
} from "../schemas/auth.schema.js";
import {
  AuthServiceError,
  autenticarUsuario,
  autorizarTipoCadastro,
  redefinirSenha,
  reenviarCodigo,
  registrarUsuario,
  renovarToken,
  solicitarRedefinicaoSenha,
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
      TOKEN_INVALIDO: 401,
      CADASTRO_NAO_AUTORIZADO: 403,
      SENHA_EXPIRADA: 403,
      AGUARDE_REENVIO: 429,
    };

    return res.status(statusPorCodigo[error.code] ?? 400).json({
      code: error.code,
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
    // Usa o tipo validado, que vale ALUNO quando não é informado.
    const tipoAutorizado = await autorizarTipoCadastro(
      validacao.data.tipo,
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
export async function reenviar(req: Request, res: Response) {
  const validacao = emailSchema.safeParse(req.body);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Informe um e-mail válido.",
      errors: validacao.error.issues,
    });
  }

  try {
    await reenviarCodigo(validacao.data.email);

    return res.status(200).json({
      message:
        "Se houver uma validação pendente para esse e-mail, " +
        "enviamos um novo código.",
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function esqueciSenha(req: Request, res: Response) {
  const validacao = emailSchema.safeParse(req.body);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Informe um e-mail válido.",
      errors: validacao.error.issues,
    });
  }

  try {
    await solicitarRedefinicaoSenha(validacao.data.email);

    return res.status(200).json({
      message:
        "Se o e-mail estiver cadastrado, você receberá um código " +
        "para redefinir a senha.",
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function redefinir(req: Request, res: Response) {
  const validacao = resetPasswordSchema.safeParse(req.body);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Os dados para redefinir a senha são inválidos.",
      errors: validacao.error.issues,
    });
  }

  try {
    await redefinirSenha(validacao.data);

    return res.status(200).json({
      message: "Senha redefinida com sucesso. Faça login novamente.",
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

export function renovar(req: Request, res: Response) {
  // O middleware autenticar já validou o token atual e a conta.
  try {
    const token = renovarToken(req.usuarioAutenticado!.id);

    return res.status(200).json({ token });
  } catch (error) {
    return responderErro(res, error);
  }
}
