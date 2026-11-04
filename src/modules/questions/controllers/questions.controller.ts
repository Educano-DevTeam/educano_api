import type { Request, Response } from "express";
import { responderErro, responderValidacao } from "../../../shared/erros.js";
import {
  idQuestaoSchema,
  listarQuestoesQuerySchema,
  salvarQuestaoSchema,
} from "../schemas/questions.schema.js";
import {
  atualizarQuestao,
  consultarQuestao,
  criarQuestao,
  excluirQuestao,
  listarQuestoes,
  relatorioQuestoes,
} from "../services/questions.service.js";

const CONTEXTO = "questões";

export async function listar(req: Request, res: Response) {
  const filtros = listarQuestoesQuerySchema.safeParse(req.query);

  if (!filtros.success) {
    return responderValidacao(res, "Filtros ou página inválidos.", filtros.error);
  }

  try {
    const resultado = await listarQuestoes(req.usuarioAutenticado!, filtros.data);
    return res.status(200).json(resultado);
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function relatorio(_req: Request, res: Response) {
  try {
    const dados = await relatorioQuestoes();
    return res.status(200).json(dados);
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function consultar(req: Request, res: Response) {
  const params = idQuestaoSchema.safeParse(req.params);

  if (!params.success) {
    return responderValidacao(res, "Questão inválida.", params.error);
  }

  try {
    const questao = await consultarQuestao(params.data.id);
    return res.status(200).json({ questao });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function criar(req: Request, res: Response) {
  const dados = salvarQuestaoSchema.safeParse(req.body);

  if (!dados.success) {
    return responderValidacao(res, "Os dados da questão são inválidos.", dados.error);
  }

  try {
    const questao = await criarQuestao(req.usuarioAutenticado!, dados.data);
    return res.status(201).json({ message: "Questão cadastrada com sucesso.", questao });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function atualizar(req: Request, res: Response) {
  const params = idQuestaoSchema.safeParse(req.params);
  const dados = salvarQuestaoSchema.safeParse(req.body);

  if (!params.success) {
    return responderValidacao(res, "Questão inválida.", params.error);
  }

  if (!dados.success) {
    return responderValidacao(res, "Os dados da questão são inválidos.", dados.error);
  }

  try {
    const questao = await atualizarQuestao(
      req.usuarioAutenticado!,
      params.data.id,
      dados.data,
    );
    return res.status(200).json({ message: "Questão atualizada com sucesso.", questao });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function excluir(req: Request, res: Response) {
  const params = idQuestaoSchema.safeParse(req.params);

  if (!params.success) {
    return responderValidacao(res, "Questão inválida.", params.error);
  }

  try {
    await excluirQuestao(req.usuarioAutenticado!, params.data.id);
    return res.status(200).json({ message: "Questão excluída com sucesso." });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}
