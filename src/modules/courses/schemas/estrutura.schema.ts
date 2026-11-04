import { z } from "zod";

const uuid = z.string().uuid();

const conteudoSchema = z.object({
  id: uuid.optional(),
  tipo: z.enum(["VIDEO", "AUDIO", "PDF", "DOCUMENTO", "ATIVIDADE"]),
  titulo: z.string().trim().min(2).max(150),
  descricao: z.string().trim().max(5000).optional(),
  // Aula: arquivo enviado antes em POST /api/files (finalidade MATERIAL_AULA).
  idArquivo: uuid.optional(),
  duracaoMinutos: z.number().int().min(0).max(24 * 60).optional(),
  quantidadePaginas: z.number().int().min(0).max(10000).optional(),
  // Atividade: questões do banco e tempo para responder.
  tempoMinutos: z.number().int().min(1).max(600).optional(),
  idsQuestoes: z.array(uuid).max(100).optional(),
});

const moduloSchema = z.object({
  id: uuid.optional(),
  titulo: z.string().trim().min(2).max(150),
  descricao: z.string().trim().max(5000).optional(),
  licaoTitulo: z.string().trim().max(150).optional(),
  xp: z.number().int().min(0).max(10000).default(0),
  conteudos: z.array(conteudoSchema).max(100).default([]),
});

const sessaoSchema = z.object({
  id: uuid.optional(),
  titulo: z.string().trim().min(2).max(150),
  subtitulo: z.string().trim().max(200).optional(),
  descricao: z.string().trim().max(5000).optional(),
  modulos: z.array(moduloSchema).max(100).default([]),
});

export const salvarEstruturaSchema = z.object({
  sessoes: z.array(sessaoSchema).max(50),
});

export type ConteudoInput = z.infer<typeof conteudoSchema>;
export type ModuloEstruturaInput = z.infer<typeof moduloSchema>;
export type SessaoEstruturaInput = z.infer<typeof sessaoSchema>;
