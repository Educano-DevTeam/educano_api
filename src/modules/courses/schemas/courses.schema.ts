import { z } from "zod";

const uuidSchema = z.string().uuid();

const categoriaSchema = z.enum([
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

const statusSchema = z.enum([
  "RASCUNHO",
  "INATIVO",
  "ATIVO",
]);

export const criarCursoSchema = z.object({
  nome: z.string().trim().min(3).max(150),
  categoria: categoriaSchema,

  descricao: z.string().trim().max(10000).optional(),

  vagas: z.number().int().positive().nullable().optional(),

  preco: z.number().min(0).nullable().optional(),

  cor: z.string().trim().max(30).nullable().optional(),

  idCapa: uuidSchema.nullable().optional(),
}).strict();

export const atualizarCursoSchema = z.object({
  nome: z.string().trim().min(3).max(150).optional(),

  categoria: categoriaSchema.optional(),

  descricao: z.string().trim().max(10000).nullable().optional(),

  vagas: z.number().int().positive().nullable().optional(),

  preco: z.number().min(0).nullable().optional(),

  cor: z.string().trim().max(30).nullable().optional(),

  idCapa: uuidSchema.nullable().optional(),

  status: statusSchema.optional(),
}).strict().refine(
  (dados) => Object.keys(dados).length > 0,
  {
    message: "Informe ao menos um campo para atualizar.",
  },
);

export const idCursoParamsSchema = z.object({
  id: uuidSchema,
});

export const listarCursosQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),

  nome: z.string().trim().max(150).optional(),

  categoria: categoriaSchema.optional(),

  status: statusSchema.optional(),
});

export type CriarCursoSchemaInput = z.infer<typeof criarCursoSchema>;
export type AtualizarCursoSchemaInput = z.infer<typeof atualizarCursoSchema>;
export type ListarCursosQueryInput = z.infer<typeof listarCursosQuerySchema>;