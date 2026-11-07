
import type { Request, Response } from "express";
import { z } from "zod";

import {
  CourseAccessError,
  inscreverUsuario,
  consultarMinhaInscricao,
  cancelarMinhaInscricao,
  listarInscritos,
  listarProfessoresDisponiveis,
  listarProfessoresVinculados,
  vincularProfessor,
  desvincularProfessor,
} from "../services/course-access.service.js";

const paramsSchema = z.object({
  id: z.string().uuid(),
});

const professorBodySchema = z.object({
  idProfessor: z.string().uuid(),
}).strict();

const paginaSchema = z.coerce.number().int().min(1).default(1);

function responderErro(res: Response, error: unknown) {
  if (error instanceof CourseAccessError) {
    const status: Record<string, number> = {
      ID_INVALIDO: 400,
      PROFESSOR_INVALIDO: 400,

      SEM_PERMISSAO: 403,

      CURSO_NAO_ENCONTRADO: 404,
      INSCRICAO_NAO_ENCONTRADA: 404,
      VINCULO_NAO_ENCONTRADO: 404,

      CURSO_NAO_DISPONIVEL: 409,
      JA_INSCRITO: 409,
      VAGAS_ESGOTADAS: 409,
      CONCORRENCIA_INSCRICAO: 409,
      PROFESSOR_JA_VINCULADO: 409,
    };

    return res.status(status[error.code] ?? 400).json({
      message: error.message,
      code: error.code,
    });
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    ["P1001", "P1002", "P2024"].includes(error.code)
  ) {
    console.error("Banco de dados indisponível:", error);

    return res.status(503).json({
      message: "Banco de dados temporariamente indisponível.",
    });
  }

  console.error("Erro nas operações de acesso ao curso:", error);

  return res.status(500).json({
    message: "Não foi possível concluir a solicitação.",
  });
}

function validarCurso(req: Request, res: Response) {
  const validacao = paramsSchema.safeParse(req.params);

  if (!validacao.success) {
    res.status(400).json({
      message: "Identificador de curso inválido.",
    });
    return null;
  }

  return validacao.data.id;
}

// -----------------------------------------------------
// INSCRIÇÕES
// -----------------------------------------------------

export async function inscrever(req: Request, res: Response) {
  const idCurso = validarCurso(req, res);
  if (!idCurso) return;

  try {
    const usuario = req.usuarioAutenticado!;

    const resultado = await inscreverUsuario(
      idCurso,
      usuario.id,
    );

    return res.status(201).json({
      message: "Inscrição realizada com sucesso.",
      ...resultado,
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function consultarMinha(req: Request, res: Response) {
  const idCurso = validarCurso(req, res);
  if (!idCurso) return;

  try {
    const resultado = await consultarMinhaInscricao(
      idCurso,
      req.usuarioAutenticado!.id,
    );

    return res.status(200).json(resultado);
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function cancelarMinha(req: Request, res: Response) {
  const idCurso = validarCurso(req, res);
  if (!idCurso) return;

  try {
    await cancelarMinhaInscricao(
      idCurso,
      req.usuarioAutenticado!.id,
    );

    return res.status(200).json({
      message: "Inscrição cancelada com sucesso.",
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function listarInscritosController(
  req: Request,
  res: Response,
) {
  const idCurso = validarCurso(req, res);
  if (!idCurso) return;

  const pagina = paginaSchema.safeParse(req.query.pagina);

  if (!pagina.success) {
    return res.status(400).json({
      message: "Número de página inválido.",
    });
  }

  try {
    const usuario = req.usuarioAutenticado!;

    const resultado = await listarInscritos(
      idCurso,
      usuario.id,
      usuario.tipo,
      pagina.data,
    );

    return res.status(200).json(resultado);
  } catch (error) {
    return responderErro(res, error);
  }
}

// -----------------------------------------------------
// PROFESSORES
// -----------------------------------------------------

export async function listarDisponiveis(
  req: Request,
  res: Response,
) {
  const idCurso = validarCurso(req, res);
  if (!idCurso) return;

  const pagina = paginaSchema.safeParse(req.query.pagina);

  if (!pagina.success) {
    return res.status(400).json({
      message: "Número de página inválido.",
    });
  }

  try {
    const usuario = req.usuarioAutenticado!;

    const resultado = await listarProfessoresDisponiveis(
      idCurso,
      usuario.id,
      usuario.tipo,
      pagina.data,
    );

    return res.status(200).json(resultado);
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function listarVinculados(
  req: Request,
  res: Response,
) {
  const idCurso = validarCurso(req, res);
  if (!idCurso) return;

  try {
    const usuario = req.usuarioAutenticado!;

    const resultado = await listarProfessoresVinculados(
      idCurso,
      usuario.id,
      usuario.tipo,
    );

    return res.status(200).json({
      dados: resultado,
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function vincular(req: Request, res: Response) {
  const idCurso = validarCurso(req, res);
  if (!idCurso) return;

  const body = professorBodySchema.safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({
      message: "Informe um idProfessor válido.",
      errors: body.error.issues,
    });
  }

  try {
    const usuario = req.usuarioAutenticado!;

    const resultado = await vincularProfessor(
      idCurso,
      body.data.idProfessor,
      usuario.id,
      usuario.tipo,
    );

    return res.status(201).json({
      message: "Professor vinculado ao curso com sucesso.",
      vinculo: resultado,
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function desvincular(
  req: Request,
  res: Response,
) {
  const idCurso = validarCurso(req, res);
  if (!idCurso) return;

  const professor = z.object({
    idProfessor: z.string().uuid(),
  }).safeParse(req.params);

  if (!professor.success) {
    return res.status(400).json({
      message: "Identificador de professor inválido.",
    });
  }

  try {
    const usuario = req.usuarioAutenticado!;

    await desvincularProfessor(
      idCurso,
      professor.data.idProfessor,
      usuario.id,
      usuario.tipo,
    );

    return res.status(200).json({
      message: "Professor desvinculado do curso com sucesso.",
    });
  } catch (error) {
    return responderErro(res, error);
  }
}
