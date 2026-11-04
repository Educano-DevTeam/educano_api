import { z } from "zod";

export const criarAulaSchema = z.object({
  idModulo: z.string().uuid(),
  titulo: z.string().trim().min(2).max(150),
  descricao: z.string().trim().max(5000).optional(),
  tipo: z.enum(["VIDEO", "AUDIO", "PDF", "DOCUMENTO"]),
  // Arquivo enviado antes em POST /api/files (finalidade MATERIAL_AULA).
  idArquivo: z.string().uuid(),
  duracaoMinutos: z.number().int().min(0).max(24 * 60).optional(),
  quantidadePaginas: z.number().int().min(0).max(10000).optional(),
});

export const idAulaParamsSchema = z.object({ id: z.string().uuid() });
