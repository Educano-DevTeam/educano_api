import type { Request, Response } from "express";
import { responderErro } from "../../../shared/erros.js";
import { consultarProgresso } from "../services/progress.service.js";

export async function meuProgresso(req: Request, res: Response) {
  try {
    const progresso = await consultarProgresso(req.usuarioAutenticado!);
    return res.status(200).json(progresso);
  } catch (error) {
    return responderErro(res, error, "progresso");
  }
}
