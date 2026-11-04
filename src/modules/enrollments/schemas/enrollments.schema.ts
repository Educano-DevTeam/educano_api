import { z } from "zod";

const turmaSchema = z.enum(["MANHA", "TARDE", "NOITE", "EAD"]);

export const inscreverSchema = z.object({
  idCurso: z.string().uuid(),
  turma: turmaSchema.default("EAD"),
});

export const inscreverUsuarioSchema = z.object({
  email: z.string().trim().email().max(255),
  turma: turmaSchema.default("EAD"),
});

export const idCursoParamsSchema = z.object({
  idCurso: z.string().uuid(),
});
