import type { Request, Response } from "express";
import { responderErro, responderValidacao } from "../../../shared/erros.js";
import { criarAulaSchema, idAulaParamsSchema } from "../schemas/lessons.schema.js";
import {
  concluirAula,
  criarAula,
  excluirAula,
  gerarAcessoAula,
} from "../services/lessons.service.js";

const CONTEXTO = "aulas";

export async function criar(req: Request, res: Response) {
  const dados = criarAulaSchema.safeParse(req.body);

  if (!dados.success) {
    return responderValidacao(res, "Os dados da aula são inválidos.", dados.error);
  }

  try {
    const aula = await criarAula(req.usuarioAutenticado!, dados.data);
    return res.status(201).json({ message: "Aula cadastrada com sucesso.", aula });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function excluir(req: Request, res: Response) {
  const params = idAulaParamsSchema.safeParse(req.params);

  if (!params.success) return responderValidacao(res, "Aula inválida.", params.error);

  try {
    await excluirAula(req.usuarioAutenticado!, params.data.id);
    return res.status(200).json({ message: "Aula excluída com sucesso." });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function acessar(req: Request, res: Response) {
  const params = idAulaParamsSchema.safeParse(req.params);

  if (!params.success) return responderValidacao(res, "Aula inválida.", params.error);

  try {
    const acesso = await gerarAcessoAula(req.usuarioAutenticado!, params.data.id);
    return res.status(200).json(acesso);
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function concluir(req: Request, res: Response) {
  const params = idAulaParamsSchema.safeParse(req.params);

  if (!params.success) return responderValidacao(res, "Aula inválida.", params.error);

  try {
    const resultado = await concluirAula(req.usuarioAutenticado!, params.data.id);
    return res.status(200).json({
      concluido: true,
      primeiraConclusao: resultado.novo,
      moduloConcluido: resultado.moduloConcluido,
      recompensa: { xp: resultado.xp, moedas: resultado.moedas },
    });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}
