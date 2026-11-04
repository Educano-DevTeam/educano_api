import { z } from "zod";

export const salvarFlashcardSchema = z.object({
  titulo: z.string().trim().min(1).max(120),
  pergunta: z.string().trim().min(1).max(2000),
  resposta: z.string().trim().min(1).max(2000),
  repeticoesMensais: z.number().int().min(1).max(30).default(4),
});

export const idFlashcardSchema = z.object({ id: z.string().uuid() });

export type SalvarFlashcardInput = z.infer<typeof salvarFlashcardSchema>;
