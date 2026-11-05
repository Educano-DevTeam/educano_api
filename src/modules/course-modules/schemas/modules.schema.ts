import { z } from "zod";

const uuidSchema = z.string().uuid();

export const criarModuloSchema = z.object({
  idSessao: uuidSchema,
  titulo: z.string().trim().min(3).max(150),
  descricao: z.string().trim().max(10000).nullable().optional(),
}).strict();

export const atualizarModuloSchema = z.object({
  titulo: z.string().trim().min(3).max(150).optional(),
  descricao: z.string().trim().max(10000).nullable().optional(),
}).strict().refine(
  (dados) => Object.keys(dados).length > 0,
  { message: "Informe ao menos um campo para atualizar." },
);

export const idModuloParamsSchema = z.object({
  id: uuidSchema,
});

export const listarModulosQuerySchema = z.object({
  idSessao: uuidSchema,
});