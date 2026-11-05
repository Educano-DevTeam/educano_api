import type { Request, Response } from "express";

import {
  criarModuloSchema,
  atualizarModuloSchema,
  idModuloParamsSchema,
  listarModulosQuerySchema,
} from "../schemas/modules.schema.js";

import {
  CourseModulesServiceError,
  criarModulo,
  listarModulos,
  consultarModulo,
  atualizarModulo,
  excluirModulo,
} from "../services/modules.service.js";

function responderErro(res: Response, error: unknown) {
  if (error instanceof CourseModulesServiceError) {
    const status: Record<string, number> = {
      ID_INVALIDO: 400,
      SEM_PERMISSAO: 403,
      SESSAO_NAO_ENCONTRADA: 404,
      MODULO_NAO_ENCONTRADO: 404,
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

  console.error("Erro no módulo de módulos:", error);

  return res.status(500).json({
    message: "Não foi possível concluir a solicitação.",
  });
}

export async function criar(req: Request, res: Response) {
  const validacao = criarModuloSchema.safeParse(req.body);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Dados inválidos para criação do módulo.",
      errors: validacao.error.issues,
    });
  }

  try {
    const usuario = req.usuarioAutenticado!;

    const modulo = await criarModulo(
      usuario.id,
      usuario.tipo,
      validacao.data,
    );

    return res.status(201).json({
      message: "Módulo criado com sucesso.",
      modulo,
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function listar(req: Request, res: Response) {
  const validacao = listarModulosQuerySchema.safeParse(req.query);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Informe um idSessao válido.",
      errors: validacao.error.issues,
    });
  }

  try {
    const usuario = req.usuarioAutenticado!;

    const modulos = await listarModulos(
      validacao.data.idSessao,
      usuario.id,
      usuario.tipo,
    );

    return res.status(200).json({ dados: modulos });
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function consultar(req: Request, res: Response) {
  const validacao = idModuloParamsSchema.safeParse(req.params);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Identificador de módulo inválido.",
    });
  }

  try {
    const usuario = req.usuarioAutenticado!;

    const modulo = await consultarModulo(
      validacao.data.id,
      usuario.id,
      usuario.tipo,
    );

    return res.status(200).json({ modulo });
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function atualizar(req: Request, res: Response) {
  const params = idModuloParamsSchema.safeParse(req.params);
  const body = atualizarModuloSchema.safeParse(req.body);

  if (!params.success || !body.success) {
    return res.status(400).json({
      message: "Dados inválidos para atualização do módulo.",
      errors: [
        ...(!params.success ? params.error.issues : []),
        ...(!body.success ? body.error.issues : []),
      ],
    });
  }

  try {
    const usuario = req.usuarioAutenticado!;

    const modulo = await atualizarModulo(
      params.data.id,
      usuario.id,
      usuario.tipo,
      body.data,
    );

    return res.status(200).json({
      message: "Módulo atualizado com sucesso.",
      modulo,
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function excluir(req: Request, res: Response) {
  const validacao = idModuloParamsSchema.safeParse(req.params);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Identificador de módulo inválido.",
    });
  }

  try {
    const usuario = req.usuarioAutenticado!;

    await excluirModulo(
      validacao.data.id,
      usuario.id,
      usuario.tipo,
    );

    return res.status(200).json({
      message: "Módulo excluído com sucesso.",
    });
  } catch (error) {
    return responderErro(res, error);
  }
}