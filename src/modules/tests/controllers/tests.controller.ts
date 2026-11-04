import type { Request, Response } from "express";
import { responderErro, responderValidacao } from "../../../shared/erros.js";
import { criarAtividadeSchema, idTesteParamsSchema } from "../schemas/tests.schema.js";
import { criarAtividade, excluirAtividade } from "../services/tests.service.js";

export async function criar(req: Request, res: Response) {
  const dados = criarAtividadeSchema.safeParse(req.body);

  if (!dados.success) {
    return responderValidacao(res, "Os dados da atividade são inválidos.", dados.error);
  }

  try {
    const atividade = await criarAtividade(req.usuarioAutenticado!, dados.data);
    return res.status(201).json({ message: "Atividade cadastrada com sucesso.", atividade });
  } catch (error) {
    return responderErro(res, error, "atividades");
  }
}

export async function excluir(req: Request, res: Response) {
  const params = idTesteParamsSchema.safeParse(req.params);

  if (!params.success) return responderValidacao(res, "Atividade inválida.", params.error);

  try {
    await excluirAtividade(req.usuarioAutenticado!, params.data.id);
    return res.status(200).json({ message: "Atividade excluída com sucesso." });
  } catch (error) {
    return responderErro(res, error, "atividades");
  }
}
