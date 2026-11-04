
import { z } from "zod";
import { senhaForteSchema } from "../../auth/schemas/auth.schema.js";

const identificadorSchema = z.string().trim().min(1).max(255);

export const identificadorParamsSchema = z.object({
  identifier: identificadorSchema,
});

export const listarUsuariosQuerySchema = z.object({
  // Página começa em 1; cada página contém exatamente 30 registros.
  page: z.coerce.number().int().min(1).default(1),

  // Filtros opcionais da listagem do dashboard.
  busca: z.string().trim().max(120).optional(),
  tipo: z.enum(["ALUNO", "PROFESSOR", "PARCEIRO", "ADMIN"]).optional(),
  status: z.enum(["PENDENTE", "ATIVO", "INATIVO"]).optional(),
});

export const editarUsuarioSchema = z.object({
  nome: z.string().trim().min(2).max(120).optional(),
  email: z.string().trim().email().max(255).optional(),
}).strict().refine(
  (dados) => Object.keys(dados).length > 0,
  { message: "Informe ao menos um campo para atualizar." },
);

export const alterarStatusSchema = z.object({
  status: z.enum(["ATIVO", "INATIVO"]),
});

// O próprio usuário só altera o nome; o e-mail exige nova validação.
export const editarMeuUsuarioSchema = z.object({
  nome: z.string().trim().min(2).max(120),
}).strict();

export const alterarSenhaSchema = z.object({
  senhaAtual: z.string().min(1).max(72),
  novaSenha: senhaForteSchema,
});

export type ListarUsuariosQuery = z.infer<typeof listarUsuariosQuerySchema>;
export type AlterarSenhaInput = z.infer<typeof alterarSenhaSchema>;
export type EditarUsuarioInput = z.infer<typeof editarUsuarioSchema>;
