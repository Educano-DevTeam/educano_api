import type { Request, Response } from "express";
import { responderErro, responderValidacao } from "../../../shared/erros.js";
import { idCursoParamsSchema } from "../schemas/courses.schema.js";
import { salvarEstruturaSchema } from "../schemas/estrutura.schema.js";
import { consultarEstrutura, salvarEstrutura } from "../services/estrutura.service.js";

export async function consultarConteudo(req: Request, res: Response) {
  const params = idCursoParamsSchema.safeParse(req.params);

  if (!params.success) {
    return responderValidacao(res, "Identificador de curso inválido.", params.error);
  }

  try {
    const estrutura = await consultarEstrutura(req.usuarioAutenticado!, params.data.id);
    return res.status(200).json(estrutura);
  } catch (error) {
    return responderErro(res, error, "cursos");
  }
}

export async function salvarConteudo(req: Request, res: Response) {
  const params = idCursoParamsSchema.safeParse(req.params);
  const dados = salvarEstruturaSchema.safeParse(req.body);

  if (!params.success) {
    return responderValidacao(res, "Identificador de curso inválido.", params.error);
  }

  if (!dados.success) {
    return responderValidacao(res, "A estrutura do curso é inválida.", dados.error);
  }

  try {
    const estrutura = await salvarEstrutura(
      req.usuarioAutenticado!,
      params.data.id,
      dados.data.sessoes,
    );
    return res.status(200).json({ message: "Conteúdo do curso salvo.", ...estrutura });
  } catch (error) {
    return responderErro(res, error, "cursos");
  }
}
