
import { z } from "zod";

export const tipoUsuarioSchema = z.enum([
  "ALUNO",
  "PROFESSOR",
  "PARCEIRO",
  "ADMIN",
]);

// Mínimo de 8 caracteres, com letra maiúscula, número e caractere especial.
export const senhaForteSchema = z
  .string()
  .min(8, "A senha deve ter no mínimo 8 caracteres.")
  .max(72)
  .regex(/[A-Z]/, "A senha deve ter ao menos uma letra maiúscula.")
  .regex(/[0-9]/, "A senha deve ter ao menos um número.")
  .regex(/[^A-Za-z0-9]/, "A senha deve ter ao menos um caractere especial.");

// O cadastro público cria somente contas de aluno.
export const registerSchema = z.object({
  nome: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(255),
  senha: senhaForteSchema,
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

export const emailSchema = z.object({
  email: z.string().trim().email().max(255),
});

export const resetPasswordSchema = z.object({
  email: z.string().trim().email().max(255),
  codigo: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6}$/),
  novaSenha: senhaForteSchema,
});

export type TipoUsuarioCadastro = z.infer<typeof tipoUsuarioSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyCodeInput = z.infer<typeof verifyCodeSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;