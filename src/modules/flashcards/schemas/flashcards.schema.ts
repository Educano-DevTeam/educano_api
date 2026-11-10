import { z } from "zod";

const uuidSchema = z.string().uuid("Identificador inválido.");

export const criarFlashcardSchema = z.object({
  titulo: z.string()
    .trim()
    .min(1, "O título é obrigatório.")
    .max(150),

  pergunta: z.string()
    .trim()
    .min(1, "A pergunta é obrigatória.")
    .max(20000),

  resposta: z.string()
    .trim()
    .min(1, "A resposta é obrigatória.")
    .max(20000),

  repeticoesMes: z.coerce.number()
    .int()
    .min(1)
    .max(30),
}).strict();

export const atualizarFlashcardSchema = criarFlashcardSchema
  .partial()
  .strict()
  .refine((dados) => Object.keys(dados).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });

export const idFlashcardParamsSchema = z.object({
  id: uuidSchema,
});

export const listarFlashcardsQuerySchema = z.object({
  busca: z.string().trim().max(150).optional(),

  pagina: z.coerce.number().int().positive().default(1),

  limite: z.coerce.number().int().min(1).max(100).default(30),
});