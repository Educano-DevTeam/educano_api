import type { Request, Response } from "express";

import {
  criarFlashcardSchema,
  atualizarFlashcardSchema,
  idFlashcardParamsSchema,
  listarFlashcardsQuerySchema,
} from "../schemas/flashcards.schema.js";

import {
  FlashcardsServiceError,
  criarFlashcard,
  listarFlashcards,
  consultarFlashcard,
  atualizarFlashcard,
  excluirFlashcard,
  visualizarFlashcard,
} from "../services/flashcards.service.js";

function responderErro(res: Response, erro: unknown) {
  if (erro instanceof FlashcardsServiceError) {
    const status: Record<string, number> = {
      FLASHCARD_NAO_ENCONTRADO: 404,
    };

    return res.status(status[erro.code] ?? 400).json({
      message: erro.message,
    });
  }

  console.error("Erro no módulo de flashcards:", erro);

  return res.status(500).json({
    message: "Não foi possível concluir a solicitação.",
  });
}

// -----------------------------------------------------
// CRIAR FLASHCARD
// -----------------------------------------------------

export async function criar(req: Request, res: Response) {
  const validacao = criarFlashcardSchema.safeParse(req.body);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Dados inválidos para criação do flashcard.",
      errors: validacao.error.issues,
    });
  }

  try {
    const flashcard = await criarFlashcard(
      req.usuarioAutenticado!.id,
      validacao.data,
    );

    return res.status(201).json({
      message: "Flashcard criado com sucesso.",
      flashcard,
    });
  } catch (erro) {
    return responderErro(res, erro);
  }
}

// -----------------------------------------------------
// LISTAR FLASHCARDS
// -----------------------------------------------------

export async function listar(req: Request, res: Response) {
  const validacao = listarFlashcardsQuerySchema.safeParse(req.query);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Filtros inválidos.",
      errors: validacao.error.issues,
    });
  }

  try {
    const resultado = await listarFlashcards(
      req.usuarioAutenticado!.id,
      validacao.data,
    );

    return res.status(200).json({
      message: "Flashcards consultados com sucesso.",
      ...resultado,
    });
  } catch (erro) {
    return responderErro(res, erro);
  }
}

// -----------------------------------------------------
// CONSULTAR FLASHCARD
// -----------------------------------------------------

export async function consultar(req: Request, res: Response) {
  const validacao = idFlashcardParamsSchema.safeParse(req.params);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Identificador do flashcard inválido.",
    });
  }

  try {
    const flashcard = await consultarFlashcard(
      validacao.data.id,
      req.usuarioAutenticado!.id,
    );

    return res.status(200).json({
      message: "Flashcard consultado com sucesso.",
      flashcard,
    });
  } catch (erro) {
    return responderErro(res, erro);
  }
}

// -----------------------------------------------------
// ATUALIZAR FLASHCARD
// -----------------------------------------------------

export async function atualizar(req: Request, res: Response) {
  const params = idFlashcardParamsSchema.safeParse(req.params);
  const body = atualizarFlashcardSchema.safeParse(req.body);

  if (!params.success || !body.success) {
    return res.status(400).json({
      message: "Dados inválidos para atualização do flashcard.",
      errors: [
        ...(!params.success ? params.error.issues : []),
        ...(!body.success ? body.error.issues : []),
      ],
    });
  }

  try {
    const flashcard = await atualizarFlashcard(
      params.data.id,
      req.usuarioAutenticado!.id,
      body.data,
    );

    return res.status(200).json({
      message: "Flashcard atualizado com sucesso.",
      flashcard,
    });
  } catch (erro) {
    return responderErro(res, erro);
  }
}

// -----------------------------------------------------
// EXCLUIR FLASHCARD
// -----------------------------------------------------

export async function excluir(req: Request, res: Response) {
  const validacao = idFlashcardParamsSchema.safeParse(req.params);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Identificador do flashcard inválido.",
    });
  }

  try {
    await excluirFlashcard(
      validacao.data.id,
      req.usuarioAutenticado!.id,
    );

    return res.status(200).json({
      message: "Flashcard excluído com sucesso.",
    });
  } catch (erro) {
    return responderErro(res, erro);
  }
}

// -----------------------------------------------------
// VISUALIZAR FLASHCARD
// -----------------------------------------------------

export async function visualizar(req: Request, res: Response) {
  const validacao = idFlashcardParamsSchema.safeParse(req.params);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Identificador do flashcard inválido.",
    });
  }

  try {
    const flashcard = await visualizarFlashcard(
      validacao.data.id,
      req.usuarioAutenticado!.id,
    );

    return res.status(200).json({
      message: "Visualização registrada com sucesso.",
      flashcard,
    });
  } catch (erro) {
    return responderErro(res, erro);
  }
}