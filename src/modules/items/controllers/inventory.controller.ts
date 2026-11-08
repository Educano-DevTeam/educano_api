import type { Request, Response } from "express";
import { prisma } from "../../../config/prisma.js";

import { idInventarioParamsSchema } from "../schemas/inventory.schema.js";

import {
  ItemsServiceError,
  listarInventario,
  ativarItem,
  verificarItemInventario,
} from "../services/items.service.js";

function responderErro(res: Response, error: unknown) {
  if (error instanceof ItemsServiceError) {
    const status: Record<string, number> = {
      INVENTARIO_NAO_ENCONTRADO: 404,
      ITEM_NAO_ATIVAVEL: 409,
      BOOST_JA_ATIVO: 409,
    };

    return res.status(status[error.code] ?? 400).json({
      message: error.message,
    });
  }

  console.error("Erro no inventário:", error);

  return res.status(500).json({
    message: "Não foi possível consultar o inventário.",
  });
}

// -----------------------------------------------------
// LISTAR INVENTÁRIO DO USUÁRIO
// -----------------------------------------------------

export async function listar(req: Request, res: Response) {
  try {
    const dados = await listarInventario(
      req.usuarioAutenticado!.id,
    );

    return res.status(200).json({
      dados,
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

// -----------------------------------------------------
// ATIVAR ITEM
// -----------------------------------------------------

export async function ativar(req: Request, res: Response) {
  const validacao = idInventarioParamsSchema.safeParse(req.params);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Identificador do inventário inválido.",
    });
  }

  try {
    const inventario = await ativarItem(
      req.usuarioAutenticado!.id,
      validacao.data.idInventario,
    );

    return res.status(200).json({
      message: "Item ativado com sucesso.",
      inventario,
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

// -----------------------------------------------------
// VERIFICAR VALIDADE DO ITEM
// -----------------------------------------------------

export async function verificar(req: Request, res: Response) {
  const validacao = idInventarioParamsSchema.safeParse(req.params);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Identificador do inventário inválido.",
    });
  }

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      return verificarItemInventario(
        tx,
        req.usuarioAutenticado!.id,
        validacao.data.idInventario,
      );
    });

    return res.status(200).json(resultado);
  } catch (error) {
    return responderErro(res, error);
  }
}