import type { Request, Response } from "express";
import { responderErro, responderValidacao } from "../../../shared/erros.js";
import {
  comprarSchema,
  idItemSchema,
  listarItensQuerySchema,
  salvarItemSchema,
} from "../schemas/store.schema.js";
import {
  ativarItem,
  atualizarItem,
  comprarItem,
  consultarInventario,
  criarItem,
  excluirItem,
  listarItens,
} from "../services/store.service.js";

const CONTEXTO = "loja";

export async function listar(req: Request, res: Response) {
  const filtros = listarItensQuerySchema.safeParse(req.query);

  if (!filtros.success) {
    return responderValidacao(res, "Filtros inválidos.", filtros.error);
  }

  try {
    const resultado = await listarItens(req.usuarioAutenticado!, filtros.data);
    return res.status(200).json(resultado);
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function criar(req: Request, res: Response) {
  const dados = salvarItemSchema.safeParse(req.body);

  if (!dados.success) {
    return responderValidacao(res, "Os dados do item são inválidos.", dados.error);
  }

  try {
    const item = await criarItem(dados.data);
    return res.status(201).json({ message: "Item cadastrado com sucesso.", item });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function atualizar(req: Request, res: Response) {
  const params = idItemSchema.safeParse(req.params);
  const dados = salvarItemSchema.safeParse(req.body);

  if (!params.success) {
    return responderValidacao(res, "Item inválido.", params.error);
  }

  if (!dados.success) {
    return responderValidacao(res, "Os dados do item são inválidos.", dados.error);
  }

  try {
    const item = await atualizarItem(params.data.id, dados.data);
    return res.status(200).json({ message: "Item atualizado com sucesso.", item });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function excluir(req: Request, res: Response) {
  const params = idItemSchema.safeParse(req.params);

  if (!params.success) {
    return responderValidacao(res, "Item inválido.", params.error);
  }

  try {
    const resultado = await excluirItem(params.data.id);
    return res.status(200).json({
      message: resultado.removido
        ? "Item excluído com sucesso."
        : "O item já foi comprado por usuários e foi retirado da loja.",
      ...resultado,
    });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function comprar(req: Request, res: Response) {
  const params = idItemSchema.safeParse(req.params);
  const dados = comprarSchema.safeParse(req.body ?? {});

  if (!params.success || !dados.success) {
    return res.status(400).json({ message: "Compra inválida." });
  }

  try {
    const resultado = await comprarItem(
      req.usuarioAutenticado!,
      params.data.id,
      dados.data.quantidade,
    );
    return res.status(200).json({
      message: `${resultado.item.nome} adquirido!`,
      ...resultado,
    });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function inventario(req: Request, res: Response) {
  try {
    const resultado = await consultarInventario(req.usuarioAutenticado!);
    return res.status(200).json(resultado);
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function ativar(req: Request, res: Response) {
  const params = idItemSchema.safeParse(req.params);

  if (!params.success) {
    return responderValidacao(res, "Item inválido.", params.error);
  }

  try {
    const resultado = await ativarItem(req.usuarioAutenticado!, params.data.id);
    return res.status(200).json({ message: "Item ativado!", ...resultado });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}
