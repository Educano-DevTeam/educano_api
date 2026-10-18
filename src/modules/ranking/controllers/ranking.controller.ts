import type { Request, Response, NextFunction } from "express";
import { rankingQuerySchema } from "../schemas/ranking.schema.js";
import { consultarRanking } from "../services/ranking.service.js";

export async function listarRanking(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const validacao = rankingQuerySchema.safeParse(req.query);

    if (!validacao.success) {
      return res.status(400).json({
        mensagem: "Parâmetros de paginação inválidos.",
        erros: validacao.error.flatten(),
      });
    }

    const resultado = await consultarRanking(validacao.data.page);

    return res.status(200).json(resultado);
  } catch (erro) {
    return next(erro);
  }
}