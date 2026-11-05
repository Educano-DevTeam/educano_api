import type { Request, Response } from "express";

import {
  criarSessaoSchema,
  atualizarSessaoSchema,
  idSessaoParamsSchema,
  listarSessoesQuerySchema,
} from "../schemas/sessions.schema.js";

import {
  SessionsServiceError,
  criarSessao,
  listarSessoes,
  consultarSessao,
  atualizarSessao,
  excluirSessao,
} from "../services/sessions.service.js";

function responderErro(res: Response, error: unknown) {
  if (error instanceof SessionsServiceError) {
    const status: Record<string, number> = {
      ID_INVALIDO: 400,
      SEM_PERMISSAO: 403,
      CURSO_NAO_ENCONTRADO: 404,
      SESSAO_NAO_ENCONTRADA: 404,
    };

    return res.status(status[error.code] ?? 400).json({
      message: error.message,
    });
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    ["P1001", "P1002", "P2024"].includes(error.code)
  ) {
    return res.status(503).json({
      message: "Banco de dados temporariamente indisponível.",
    });
  }

  console.error("Erro no módulo de sessões:", error);

  return res.status(500).json({
    message: "Não foi possível concluir a solicitação.",
  });
}

export async function criar(req: Request, res: Response) {
  const validacao = criarSessaoSchema.safeParse(req.body);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Dados inválidos para criação da sessão.",
      errors: validacao.error.issues,
    });
  }

  try {
    const usuario = req.usuarioAutenticado!;

    const sessao = await criarSessao(
      usuario.id,
      usuario.tipo,
      validacao.data,
    );

    return res.status(201).json({
      message: "Sessão criada com sucesso.",
      sessao,
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function listar(req: Request, res: Response) {
  const validacao = listarSessoesQuerySchema.safeParse(req.query);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Informe um idCurso válido.",
      errors: validacao.error.issues,
    });
  }

  try {
    const usuario = req.usuarioAutenticado!;

    const sessoes = await listarSessoes(
      validacao.data.idCurso,
      usuario.id,
      usuario.tipo,
    );

    return res.status(200).json({ dados: sessoes });
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function consultar(req: Request, res: Response) {
  const validacao = idSessaoParamsSchema.safeParse(req.params);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Identificador de sessão inválido.",
    });
  }

  try {
    const usuario = req.usuarioAutenticado!;

    const sessao = await consultarSessao(
      validacao.data.id,
      usuario.id,
      usuario.tipo,
    );

    return res.status(200).json({ sessao });
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function atualizar(req: Request, res: Response) {
  const params = idSessaoParamsSchema.safeParse(req.params);
  const body = atualizarSessaoSchema.safeParse(req.body);

  if (!params.success || !body.success) {
    return res.status(400).json({
      message: "Dados inválidos para atualização da sessão.",
      errors: [
        ...(!params.success ? params.error.issues : []),
        ...(!body.success ? body.error.issues : []),
      ],
    });
  }

  try {
    const usuario = req.usuarioAutenticado!;

    const sessao = await atualizarSessao(
      params.data.id,
      usuario.id,
      usuario.tipo,
      body.data,
    );

    return res.status(200).json({
      message: "Sessão atualizada com sucesso.",
      sessao,
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function excluir(req: Request, res: Response) {
  const validacao = idSessaoParamsSchema.safeParse(req.params);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Identificador de sessão inválido.",
    });
  }

  try {
    const usuario = req.usuarioAutenticado!;

    await excluirSessao(
      validacao.data.id,
      usuario.id,
      usuario.tipo,
    );

    return res.status(200).json({
      message: "Sessão excluída com sucesso.",
    });
  } catch (error) {
    return responderErro(res, error);
  }
}