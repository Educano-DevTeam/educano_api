import type { Request, Response } from "express";

import {
  criarItemSchema,
  atualizarItemSchema,
  idItemParamsSchema,
  listarItensQuerySchema,
} from "../schemas/items.schema.js";

import {
  ItemsServiceError,
  criarItem,
  listarItens,
  listarLoja,
  consultarItem,
  atualizarItem,
  inativarItem,
  comprarItem,
} from "../services/items.service.js";

function responderErro(res: Response, error: unknown) {
  if (error instanceof ItemsServiceError) {
    const status: Record<string, number> = {
      ITEM_NAO_ENCONTRADO: 404,
      ITEM_NAO_DISPONIVEL: 404,
      PERFIL_NAO_ENCONTRADO: 404,
      MOEDAS_INSUFICIENTES: 400,
      BOOST_JA_ATIVO: 409,
      ITEM_NAO_ATIVAVEL: 409,
      INVENTARIO_NAO_ENCONTRADO: 404,
    };

    return res.status(status[error.code] ?? 400).json({
      message: error.message,
    });
  }

  console.error("Erro no módulo de itens:", error);

  return res.status(500).json({
    message: "Não foi possível concluir a solicitação.",
  });
}

// -----------------------------------------------------
// CRIAR ITEM - ADMIN
// -----------------------------------------------------

export async function criar(req: Request, res: Response) {
  const validacao = criarItemSchema.safeParse(req.body);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Dados inválidos para criação do item.",
      errors: validacao.error.issues,
    });
  }

  try {
    const item = await criarItem(
      req.usuarioAutenticado!.id,
      validacao.data,
    );

    return res.status(201).json({
      message: "Item criado com sucesso.",
      item,
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

// -----------------------------------------------------
// LISTAR ITENS - ADMIN
// -----------------------------------------------------

export async function listar(req: Request, res: Response) {
  const validacao = listarItensQuerySchema.safeParse(req.query);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Filtros inválidos.",
      errors: validacao.error.issues,
    });
  }

  try {
    const resultado = await listarItens(validacao.data);

    return res.status(200).json(resultado);
  } catch (error) {
    return responderErro(res, error);
  }
}

// -----------------------------------------------------
// LISTAR LOJA
// -----------------------------------------------------

export async function loja(_req: Request, res: Response) {
  try {
    const itens = await listarLoja();

    return res.status(200).json({
      dados: itens,
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

// -----------------------------------------------------
// CONSULTAR ITEM - ADMIN
// -----------------------------------------------------

export async function consultar(req: Request, res: Response) {
  const validacao = idItemParamsSchema.safeParse(req.params);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Identificador de item inválido.",
    });
  }

  try {
    const item = await consultarItem(validacao.data.id);

    return res.status(200).json({ item });
  } catch (error) {
    return responderErro(res, error);
  }
}

// -----------------------------------------------------
// ATUALIZAR ITEM - ADMIN
// -----------------------------------------------------

export async function atualizar(req: Request, res: Response) {
  const params = idItemParamsSchema.safeParse(req.params);
  const body = atualizarItemSchema.safeParse(req.body);

  if (!params.success || !body.success) {
    return res.status(400).json({
      message: "Dados inválidos para atualização.",
      errors: [
        ...(!params.success ? params.error.issues : []),
        ...(!body.success ? body.error.issues : []),
      ],
    });
  }

  try {
    const item = await atualizarItem(
      params.data.id,
      body.data,
    );

    return res.status(200).json({
      message: "Item atualizado com sucesso.",
      item,
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

// -----------------------------------------------------
// INATIVAR ITEM - ADMIN
// -----------------------------------------------------

export async function excluir(req: Request, res: Response) {
  const validacao = idItemParamsSchema.safeParse(req.params);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Identificador de item inválido.",
    });
  }

  try {
    await inativarItem(validacao.data.id);

    return res.status(200).json({
      message: "Item inativado com sucesso.",
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

// -----------------------------------------------------
// COMPRAR ITEM
// -----------------------------------------------------

export async function comprar(req: Request, res: Response) {
  const validacao = idItemParamsSchema.safeParse(req.params);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Identificador de item inválido.",
    });
  }

  try {
    const resultado = await comprarItem(
      req.usuarioAutenticado!.id,
      validacao.data.id,
    );

    return res.status(201).json({
      message: "Item comprado com sucesso.",
      ...resultado,
    });
  } catch (error) {
    return responderErro(res, error);
  }
}