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

export const iconeCapaSchema = z.enum([
  "livro",
  "matematica",
  "biologia",
  "ciencias",
  "historia",
  "geografia",
  "idiomas",
  "artes",
]);

const vagasSchema = z.preprocess(
  (valor) => {
    if (valor === "" || valor === undefined) return undefined;
    if (valor === "null") return null;
    if (typeof valor === "string") return Number(valor);
    return valor;
  },
  z.number().int().positive().nullable().optional(),
);

const precoSchema = z.preprocess(
  (valor) => {
    if (valor === "" || valor === undefined) return undefined;
    if (valor === "null") return null;
    if (typeof valor === "string") return Number(valor);
    return valor;
  },
  z.number().min(0).nullable().optional(),
);

const cargaHorariaSchema = z.preprocess(
  (valor) => {
    if (valor === "" || valor === undefined) return undefined;
    if (valor === "null") return null;
    if (typeof valor === "string") return Number(valor);
    return valor;
  },
  z.number().int().positive().nullable().optional(),
);

export const criarCursoSchema = z.object({
  nome: z.string().trim().min(3).max(150),
  categoria: categoriaSchema,
  cargaHoraria: cargaHorariaSchema,
  descricao: z.string().trim().max(10000).optional(),
  vagas: vagasSchema,
  preco: precoSchema,
  cor: z.string().trim().max(30).nullable().optional(),
  // Ícone opcional. O id do arquivo nunca é recebido pelo cliente.
  capa: iconeCapaSchema.optional(),
}).strict();

export const atualizarCursoSchema = z.object({
  nome: z.string().trim().min(3).max(150).optional(),
  categoria: categoriaSchema.optional(),
  cargaHoraria: cargaHorariaSchema,
  descricao: z.string().trim().max(10000).nullable().optional(),
  vagas: vagasSchema,
  preco: precoSchema,
  cor: z.string().trim().max(30).nullable().optional(),
  // null ou string vazia permitem remover a capa atual.
  capa: z.union([iconeCapaSchema, z.literal(""), z.null()]).optional(),

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