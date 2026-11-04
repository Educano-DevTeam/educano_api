import { z } from "zod";

export const dificuldadeSchema = z.enum(["FACIL", "MEDIO", "DIFICIL"]);

export const materiaSchema = z.enum([
  "LINGUAGENS",
  "EXATAS",
  "CIENCIAS_HUMANAS",
  "CIENCIAS_NATURAIS",
  "REDACAO",
  "VESTIBULAR",
  "TECNOLOGIA",
  "INTELIGENCIA_ARTIFICIAL",
  "DESIGN",
  "FINANCAS",
]);

export const listarQuestoesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  busca: z.string().trim().max(120).optional(),
  dificuldade: dificuldadeSchema.optional(),
  materia: materiaSchema.optional(),
  alternativas: z.coerce.number().int().min(2).max(5).optional(),
  // "true" lista apenas as questões do professor autenticado.
  minhas: z.enum(["true", "false"]).optional(),
});

const alternativaSchema = z.object({
  id: z.string().uuid().optional(),
  texto: z.string().trim().min(1).max(1000),
  correta: z.boolean(),
});

export const salvarQuestaoSchema = z.object({
  titulo: z.string().trim().min(2).max(150),
  enunciado: z.string().trim().min(5).max(10000),
  dificuldade: dificuldadeSchema,
  materia: materiaSchema,
  tema: z.string().trim().max(150).default(""),
  explicacao: z.string().trim().max(5000).default(""),
  alternativas: z
    .array(alternativaSchema)
    .min(2, "Cadastre ao menos 2 alternativas.")
    .max(5, "Cadastre no máximo 5 alternativas."),
}).superRefine((questao, ctx) => {
  if (questao.alternativas.filter((a) => a.correta).length !== 1) {
    ctx.addIssue({
      code: "custom",
      path: ["alternativas"],
      message: "Marque exatamente uma alternativa correta.",
    });
  }

  const textos = questao.alternativas.map((a) => a.texto.toLowerCase());

  if (new Set(textos).size !== textos.length) {
    ctx.addIssue({
      code: "custom",
      path: ["alternativas"],
      message: "As alternativas não podem se repetir.",
    });
  }
});

export const idQuestaoSchema = z.object({ id: z.string().uuid() });
