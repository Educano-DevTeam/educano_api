import type { z } from "zod";
import type {
  listarQuestoesQuerySchema,
  salvarQuestaoSchema,
} from "../schemas/questions.schema.js";

export type ListarQuestoesQuery = z.infer<typeof listarQuestoesQuerySchema>;
export type SalvarQuestaoInput = z.infer<typeof salvarQuestaoSchema>;
