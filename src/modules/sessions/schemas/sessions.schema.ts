import { z } from "zod";

const uuidSchema = z.string().uuid();

export const criarSessaoSchema = z.object({
  idCurso: uuidSchema,
  titulo: z.string().trim().min(3).max(150),
  subtitulo: z.string().trim().max(200).nullable().optional(),
  descricao: z.string().trim().max(10000).nullable().optional(),
}).strict();

export const atualizarSessaoSchema = z.object({
  titulo: z.string().trim().min(3).max(150).optional(),
  subtitulo: z.string().trim().max(200).nullable().optional(),
  descricao: z.string().trim().max(10000).nullable().optional(),
}).strict().refine(
  (dados) => Object.keys(dados).length > 0,
  { message: "Informe ao menos um campo para atualizar." },
);

export const idSessaoParamsSchema = z.object({
  id: uuidSchema,
});

export const listarSessoesQuerySchema = z.object({
  idCurso: uuidSchema,
});