import { z } from "zod";

export const criarAtividadeSchema = z.object({
  idModulo: z.string().uuid(),
  // Tema da atividade, exibido como título no curso.
  titulo: z.string().trim().min(2).max(150),
  tempoMinutos: z.number().int().min(1).max(600).optional(),
  idsQuestoes: z.array(z.string().uuid()).min(1).max(100),
});

export const idTesteParamsSchema = z.object({ id: z.string().uuid() });
