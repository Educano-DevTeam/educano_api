import type { Request, Response } from "express";

import {
    criarCursoSchema,
    atualizarCursoSchema,
    idCursoParamsSchema,
    listarCursosQuerySchema,
} from "../schemas/courses.schema.js";

import {
    CoursesServiceError,
    criarCurso,
    consultarCurso,
    listarCursos,
    atualizarCurso,
    excluirCurso,
} from "../services/courses.service.js";



function responderErro(res: Response, error: unknown) {
    if (error instanceof CoursesServiceError) {
        const status: Record<string, number> = {
            ID_INVALIDO: 400,
            CAPA_INVALIDA: 400,
            CURSO_INCOMPLETO: 400,

            USUARIO_INDISPONIVEL: 401,

            SEM_PERMISSAO: 403,
            SOMENTE_ADMIN: 403,

            CURSO_NAO_ENCONTRADO: 404,
            CURSO_NAO_DISPONIVEL: 404,

            CAPA_JA_UTILIZADA: 409,

            ERRO_UPLOAD_CAPA: 502,
        };

        return res.status(status[error.code] ?? 400).json({
            message: error.message,
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

    console.error("Erro no módulo de cursos:", error);

    return res.status(500).json({
        message: "Não foi possível concluir a solicitação.",
    });
}

// -----------------------------------------------------
// CRIAR CURSO
// -----------------------------------------------------

export async function criar(
    req: Request,
    res: Response,
) {
    const validacao = criarCursoSchema.safeParse(req.body);

    if (!validacao.success) {
        return res.status(400).json({
            message: "Dados inválidos para criação do curso.",
            errors: validacao.error.issues,
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        const curso = await criarCurso(
            usuario.id,
            validacao.data,
            req.file,
        );

        return res.status(201).json({
            message: "Curso criado com sucesso.",
            curso,
        });
    } catch (error) {
        return responderErro(res, error);
    }
}

// -----------------------------------------------------
// CONSULTAR CURSO
// -----------------------------------------------------

export async function consultar(
    req: Request,
    res: Response,
) {
    const validacao = idCursoParamsSchema.safeParse(req.params);

    if (!validacao.success) {
        return res.status(400).json({
            message: "Identificador de curso inválido.",
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        const curso = await consultarCurso(
            validacao.data.id,
            usuario.id,
            usuario.tipo,
        );

        return res.status(200).json({ curso });
    } catch (error) {
        return responderErro(res, error);
    }
}

// -----------------------------------------------------
// LISTAR E PESQUISAR CURSOS
// -----------------------------------------------------

export async function listar(
    req: Request,
    res: Response,
) {
    const validacao = listarCursosQuerySchema.safeParse(req.query);

    if (!validacao.success) {
        return res.status(400).json({
            message: "Filtros de pesquisa inválidos.",
            errors: validacao.error.issues,
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        const resultado = await listarCursos(
            {
                pagina: validacao.data.pagina,
                nome: validacao.data.nome,
                categoria: validacao.data.categoria,
                status: validacao.data.status,
            },
            usuario.id,
            usuario.tipo,
        );

        return res.status(200).json(resultado);
    } catch (error) {
        return responderErro(res, error);
    }
}

// -----------------------------------------------------
// ATUALIZAR CURSO
// -----------------------------------------------------

export async function atualizar(
  req: Request,
  res: Response,
) {
  const params = idCursoParamsSchema.safeParse(req.params);

  // Permite atualização contendo somente o arquivo.
  const corpo = {
    ...req.body,
    ...(req.file && Object.keys(req.body).length === 0
      ? { capa: null }
      : {}),
  };

  const body = atualizarCursoSchema.safeParse(corpo);

  if (!params.success || !body.success) {
    return res.status(400).json({
      message: "Dados inválidos para atualização do curso.",
      errors: [
        ...(!params.success ? params.error.issues : []),
        ...(!body.success ? body.error.issues : []),
      ],
    });
  }

  try {
    const usuario = req.usuarioAutenticado!;

    const curso = await atualizarCurso(
      params.data.id,
      usuario.id,
      usuario.tipo,
      body.data,
      req.file,
    );

    return res.status(200).json({
      message: "Curso atualizado com sucesso.",
      curso,
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

// -----------------------------------------------------
// EXCLUIR CURSO
// -----------------------------------------------------

export async function excluir(
    req: Request,
    res: Response,
) {
    const validacao = idCursoParamsSchema.safeParse(req.params);

    if (!validacao.success) {
        return res.status(400).json({
            message: "Identificador de curso inválido.",
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        await excluirCurso(
            validacao.data.id,
            usuario.id,
            usuario.tipo,
        );

        return res.status(200).json({
            message: "Curso excluído com sucesso.",
        });
    } catch (error) {
        return responderErro(res, error);
    }
}