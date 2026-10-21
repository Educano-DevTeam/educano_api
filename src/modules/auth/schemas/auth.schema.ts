
import { z } from "zod";

export const tipoUsuarioSchema = z.enum([
  "ALUNO",
  "PROFESSOR",
  "PARCEIRO",
  "ADMIN",
]);

// O cadastro público cria somente contas de aluno.
export const registerSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  senha: z.string().min(8).max(72),
  tipo: tipoUsuarioSchema.default("ALUNO"),
});

export const verifyCodeSchema = z.object({
  email: z.string().trim().email().max(255),
  codigo: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/),
});

export const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  senha: z.string().min(1).max(72),
});

export type TipoUsuarioCadastro = z.infer<typeof tipoUsuarioSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
export type LoginInput = z.infer<typeof loginSchema>;