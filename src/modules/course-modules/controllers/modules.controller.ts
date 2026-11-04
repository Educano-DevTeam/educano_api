import type { Request, Response } from "express";
import { responderErro, responderValidacao } from "../../../shared/erros.js";
import { criarModuloSchema, idModuloParamsSchema } from "../schemas/modules.schema.js";
import { criarModulo, excluirModulo } from "../services/modules.service.js";

export async function criar(req: Request, res: Response) {
  const dados = criarModuloSchema.safeParse(req.body);

  if (!dados.success) {
    return responderValidacao(res, "Os dados do módulo são inválidos.", dados.error);
  }

  try {
    const modulo = await criarModulo(req.usuarioAutenticado!, dados.data);
    return res.status(201).json({ message: "Módulo cadastrado com sucesso.", modulo });
  } catch (error) {
    return responderErro(res, error, "módulos");
  }
}

export async function excluir(req: Request, res: Response) {
  const params = idModuloParamsSchema.safeParse(req.params);

  if (!params.success) return responderValidacao(res, "Módulo inválido.", params.error);

  try {
    await excluirModulo(req.usuarioAutenticado!, params.data.id);
    return res.status(200).json({ message: "Módulo excluído com sucesso." });
  } catch (error) {
    return responderErro(res, error, "módulos");
  }
}
