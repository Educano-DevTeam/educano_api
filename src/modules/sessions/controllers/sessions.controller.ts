import type { Request, Response } from "express";
import { responderErro, responderValidacao } from "../../../shared/erros.js";
import { criarSessaoSchema, idSessaoParamsSchema } from "../schemas/sessions.schema.js";
import { criarSessao, excluirSessao } from "../services/sessions.service.js";

export async function criar(req: Request, res: Response) {
  const dados = criarSessaoSchema.safeParse(req.body);

  if (!dados.success) {
    return responderValidacao(res, "Os dados da sessão são inválidos.", dados.error);
  }

  try {
    const sessao = await criarSessao(req.usuarioAutenticado!, dados.data);
    return res.status(201).json({ message: "Sessão cadastrada com sucesso.", sessao });
  } catch (error) {
    return responderErro(res, error, "sessões");
  }
}

export async function excluir(req: Request, res: Response) {
  const params = idSessaoParamsSchema.safeParse(req.params);

  if (!params.success) return responderValidacao(res, "Sessão inválida.", params.error);

  try {
    await excluirSessao(req.usuarioAutenticado!, params.data.id);
    return res.status(200).json({ message: "Sessão excluída com sucesso." });
  } catch (error) {
    return responderErro(res, error, "sessões");
  }
}
