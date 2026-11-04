import type { Request, Response } from "express";
import { responderErro, responderValidacao } from "../../../shared/erros.js";
import {
  idCursoParamsSchema,
  inscreverSchema,
  inscreverUsuarioSchema,
} from "../schemas/enrollments.schema.js";
import {
  cancelarInscricao,
  inscreverSe,
  inscreverUsuario,
  listarInscritos,
  minhasInscricoes,
} from "../services/enrollments.service.js";

const CONTEXTO = "inscrições";

export async function inscrever(req: Request, res: Response) {
  const dados = inscreverSchema.safeParse(req.body);

  if (!dados.success) {
    return responderValidacao(res, "Informe um curso e uma turma válidos.", dados.error);
  }

  try {
    const inscricao = await inscreverSe(req.usuarioAutenticado!, dados.data.idCurso, dados.data.turma);
    return res.status(201).json({ message: "Inscrição realizada com sucesso.", inscricao });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function meusCursos(req: Request, res: Response) {
  try {
    const dados = await minhasInscricoes(req.usuarioAutenticado!);
    return res.status(200).json({ dados });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function cancelar(req: Request, res: Response) {
  const params = idCursoParamsSchema.safeParse(req.params);

  if (!params.success) {
    return responderValidacao(res, "Curso inválido.", params.error);
  }

  try {
    await cancelarInscricao(req.usuarioAutenticado!, params.data.idCurso);
    return res.status(200).json({ message: "Inscrição cancelada." });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function inscritosDoCurso(req: Request, res: Response) {
  const params = idCursoParamsSchema.safeParse(req.params);

  if (!params.success) {
    return responderValidacao(res, "Curso inválido.", params.error);
  }

  try {
    const dados = await listarInscritos(req.usuarioAutenticado!, params.data.idCurso);
    return res.status(200).json({ dados });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function inscreverOutroUsuario(req: Request, res: Response) {
  const params = idCursoParamsSchema.safeParse(req.params);
  const dados = inscreverUsuarioSchema.safeParse(req.body);

  if (!params.success) {
    return responderValidacao(res, "Curso inválido.", params.error);
  }

  if (!dados.success) {
    return responderValidacao(res, "Informe um e-mail e uma turma válidos.", dados.error);
  }

  try {
    const inscricao = await inscreverUsuario(
      req.usuarioAutenticado!,
      params.data.idCurso,
      dados.data.email,
      dados.data.turma,
    );
    return res.status(201).json({ message: "Usuário inscrito com sucesso.", inscricao });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}
