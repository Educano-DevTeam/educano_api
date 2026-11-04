import type { Request, Response } from "express";
import { responderErro, responderValidacao } from "../../../shared/erros.js";
import {
  idFlashcardSchema,
  salvarFlashcardSchema,
} from "../schemas/flashcards.schema.js";
import {
  atualizarFlashcard,
  criarFlashcard,
  excluirFlashcard,
  listarFlashcards,
  revisarFlashcard,
} from "../services/flashcards.service.js";

const CONTEXTO = "flashcards";

export async function listar(req: Request, res: Response) {
  try {
    const dados = await listarFlashcards(req.usuarioAutenticado!);
    return res.status(200).json({ dados });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function criar(req: Request, res: Response) {
  const dados = salvarFlashcardSchema.safeParse(req.body);

  if (!dados.success) {
    return responderValidacao(res, "Os dados do flashcard são inválidos.", dados.error);
  }

  try {
    const flashcard = await criarFlashcard(req.usuarioAutenticado!, dados.data);
    return res.status(201).json({ message: "Flashcard criado.", flashcard });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function atualizar(req: Request, res: Response) {
  const params = idFlashcardSchema.safeParse(req.params);
  const dados = salvarFlashcardSchema.safeParse(req.body);

  if (!params.success) {
    return responderValidacao(res, "Flashcard inválido.", params.error);
  }

  if (!dados.success) {
    return responderValidacao(res, "Os dados do flashcard são inválidos.", dados.error);
  }

  try {
    const flashcard = await atualizarFlashcard(
      req.usuarioAutenticado!,
      params.data.id,
      dados.data,
    );
    return res.status(200).json({ message: "Flashcard atualizado.", flashcard });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function excluir(req: Request, res: Response) {
  const params = idFlashcardSchema.safeParse(req.params);

  if (!params.success) {
    return responderValidacao(res, "Flashcard inválido.", params.error);
  }

  try {
    await excluirFlashcard(req.usuarioAutenticado!, params.data.id);
    return res.status(200).json({ message: "Flashcard excluído." });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}

export async function revisar(req: Request, res: Response) {
  const params = idFlashcardSchema.safeParse(req.params);

  if (!params.success) {
    return responderValidacao(res, "Flashcard inválido.", params.error);
  }

  try {
    const flashcard = await revisarFlashcard(req.usuarioAutenticado!, params.data.id);
    return res.status(200).json({ flashcard });
  } catch (error) {
    return responderErro(res, error, CONTEXTO);
  }
}
