import { z } from "zod";

export const criarSessaoSchema = z.object({
  idCurso: z.string().uuid(),
  titulo: z.string().trim().min(2).max(150),
  subtitulo: z.string().trim().max(200).optional(),
  descricao: z.string().trim().max(5000).optional(),
});

export const idSessaoParamsSchema = z.object({ id: z.string().uuid() });
