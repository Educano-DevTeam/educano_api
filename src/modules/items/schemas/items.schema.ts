import { z } from "zod";

const icones = [
  "RAIO",
  "ESCUDO",
  "LAMPADA",
  "CRONOMETRO",
  "REINICIAR",
  "AVATAR",
  "ESTRELA",
] as const;

export const criarItemSchema = z.object({
  nome: z.string().trim().min(2).max(100),
  descricao: z.string().trim().min(1).max(5000),
  preco: z.coerce.number().int().min(0),
  categoria: z.literal("BOOST").default("BOOST"),
  icone: z.enum(icones),
  boost: z.coerce.number().gt(1).max(100),
  tempoUso: z.coerce.number().int().positive(),
  cor: z.string().trim().min(1).max(30),
}).strict();

export const atualizarItemSchema = criarItemSchema.partial()
  .extend({
    status: z.enum(["ATIVO", "INATIVO"]).optional(),
  })
  .strict()
  .refine((dados) => Object.keys(dados).length > 0, {
    message: "Informe ao menos um campo para atualizar.",
  });

export const idItemParamsSchema = z.object({
  id: z.string().uuid(),
});

export const listarItensQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  nome: z.string().trim().max(100).optional(),
  categoria: z.enum(["BOOST"]).optional(),
  status: z.enum(["ATIVO", "INATIVO"]).optional(),
});