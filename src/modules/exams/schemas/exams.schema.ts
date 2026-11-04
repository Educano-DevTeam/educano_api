import { z } from "zod";

const uuid = z.string().uuid();

const materiaSchema = z.enum([
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

export const gerarSimuladoSchema = z.object({
  materias: z.array(materiaSchema).min(1).max(10),
  dificuldade: z.enum(["FACIL", "MEDIO", "DIFICIL"]).optional(),
  quantidade: z.number().int().min(1).max(50),
});

export const idSimuladoSchema = z.object({ id: uuid });

export const idTesteSchema = z.object({ idTeste: uuid });

export const questaoSimuladoSchema = z.object({ id: uuid, idQuestao: uuid });

export const responderSchema = z.object({
  // null limpa a resposta da questão.
  idAlternativa: uuid.nullable(),
});

export const historicoQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  tipo: z.enum(["SIMULADO", "ATIVIDADE"]).default("SIMULADO"),
});

export type GerarSimuladoInput = z.infer<typeof gerarSimuladoSchema>;
