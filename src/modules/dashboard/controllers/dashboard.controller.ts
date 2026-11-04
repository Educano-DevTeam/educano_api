import type { Request, Response } from "express";
import { responderErro } from "../../../shared/erros.js";
import { resumoDashboard } from "../services/dashboard.service.js";

export async function resumo(_req: Request, res: Response) {
  try {
    const dados = await resumoDashboard();
    return res.status(200).json(dados);
  } catch (error) {
    return responderErro(res, error, "dashboard");
  }
}
