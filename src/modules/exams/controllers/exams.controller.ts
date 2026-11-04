import type { Request, Response } from "express";
import { responderErro, responderValidacao } from "../../../shared/erros.js";
import {
  gerarSimuladoSchema,
  historicoQuerySchema,
  idTesteSchema,
  idSimuladoSchema,
  questaoSimuladoSchema,
  responderSchema,
} from "../schemas/exams.schema.js";
import {
  consultarSimulado,
  finalizarSimulado,
  gerarSimulado,
  historicoSimulados,
  iniciarAtividade,
  responderQuestao,
  usarDica,
} from "../services/exams.service.js";

const CONTEXTO = "simulados";

export async function gerar(req: Request, res: Response) {
  const dados = gerarSimuladoSchema.safeParse(req.body);

  if (!dados.success) {
    return responderValidacao(res, "As configurações do simulado são inválidas.", dados.error);
  }

  try {
    const simulado = await gerarSimulado(req.usuarioAutenticado!, dados.data);
    return res.status(201).json({ simulado });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function iniciarDaAtividade(req: Request, res: Response) {
  const params = idTesteSchema.safeParse(req.params);

  if (!params.success) {
    return responderValidacao(res, "Atividade inválida.", params.error);
  }

  try {
    const simulado = await iniciarAtividade(req.usuarioAutenticado!, params.data.idTeste);
    return res.status(201).json({ simulado });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function historico(req: Request, res: Response) {
  const filtros = historicoQuerySchema.safeParse(req.query);

  if (!filtros.success) {
    return responderValidacao(res, "Filtros inválidos.", filtros.error);
  }

  try {
    const resultado = await historicoSimulados(
      req.usuarioAutenticado!,
      filtros.data.page,
      filtros.data.tipo,
    );
    return res.status(200).json(resultado);
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function consultar(req: Request, res: Response) {
  const params = idSimuladoSchema.safeParse(req.params);

  if (!params.success) {
    return responderValidacao(res, "Simulado inválido.", params.error);
  }

  try {
    const simulado = await consultarSimulado(req.usuarioAutenticado!, params.data.id);
    return res.status(200).json({ simulado });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function responder(req: Request, res: Response) {
  const params = questaoSimuladoSchema.safeParse(req.params);
  const dados = responderSchema.safeParse(req.body);

  if (!params.success || !dados.success) {
    return res.status(400).json({ message: "Resposta inválida." });
  }

  try {
    const resultado = await responderQuestao(
      req.usuarioAutenticado!,
      params.data.id,
      params.data.idQuestao,
      dados.data.idAlternativa,
    );
    return res.status(200).json(resultado);
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function dica(req: Request, res: Response) {
  const params = questaoSimuladoSchema.safeParse(req.params);

  if (!params.success) {
    return responderValidacao(res, "Questão inválida.", params.error);
  }

  try {
    const resultado = await usarDica(
      req.usuarioAutenticado!,
      params.data.id,
      params.data.idQuestao,
    );
    return res.status(200).json(resultado);
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function finalizar(req: Request, res: Response) {
  const params = idSimuladoSchema.safeParse(req.params);

  if (!params.success) {
    return responderValidacao(res, "Simulado inválido.", params.error);
  }

  try {
    const simulado = await finalizarSimulado(req.usuarioAutenticado!, params.data.id);
    return res.status(200).json({ message: "Simulado finalizado.", simulado });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}
