import type { Request, Response } from "express";
import { z } from "zod";
import { responderErro, responderValidacao } from "../../../shared/erros.js";
import { alterarPlano, listarPlanos } from "../services/plans.service.js";

const idPlanoSchema = z.object({ id: z.string().uuid() });

export async function listar(req: Request, res: Response) {
  try {
    const resultado = await listarPlanos(req.usuarioAutenticado!);
    return res.status(200).json(resultado);
  } catch (error) {
    return responderErro(res, error, "planos");
  }
}

export async function assinar(req: Request, res: Response) {
  const params = idPlanoSchema.safeParse(req.params);

  if (!params.success) {
    return responderValidacao(res, "Plano inválido.", params.error);
  }

  try {
    const plano = await alterarPlano(req.usuarioAutenticado!, params.data.id);
    return res.status(200).json({
      message: `Plano alterado para ${plano.nome}.`,
      plano,
    });
  } catch (error) {
    return responderErro(res, error, "planos");
  }
}
