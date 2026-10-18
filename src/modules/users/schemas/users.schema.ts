
import { z } from "zod";

const identificadorSchema = z.string().trim().min(1).max(255);

export const identificadorParamsSchema = z.object({
  identifier: identificadorSchema,
});

export const listarUsuariosQuerySchema = z.object({
  // Página começa em 1; cada página contém exatamente 15 registros.
  page: z.coerce.number().int().min(1).default(1),
});

export const editarUsuarioSchema = z.object({
  nome: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(255).optional(),
}).strict().refine(
  (dados) => Object.keys(dados).length > 0,
  { message: "Informe ao menos um campo para atualizar." },
);

export type EditarUsuarioInput = z.infer<typeof editarUsuarioSchema>;
