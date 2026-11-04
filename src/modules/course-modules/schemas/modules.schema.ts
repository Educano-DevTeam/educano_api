import { z } from "zod";

export const criarModuloSchema = z.object({
  idSessao: z.string().uuid(),
  titulo: z.string().trim().min(2).max(150),
  descricao: z.string().trim().max(5000).optional(),
  licaoTitulo: z.string().trim().max(150).optional(),
  xp: z.number().int().min(0).max(10000).default(0),
});

export const idModuloParamsSchema = z.object({ id: z.string().uuid() });
