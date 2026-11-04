import { z } from "zod";

export const efeitoItemSchema = z.enum([
  "BOOST_XP",
  "ESCUDO_SEQUENCIA",
  "DICA_EXTRA",
  "TEMPO_EXTRA",
  "REVIVER_TENTATIVA",
  "COSMETICO",
]);

export const listarItensQuerySchema = z.object({
  busca: z.string().trim().max(80).optional(),
  categoria: z.string().trim().max(40).optional(),
  // "true" inclui itens desativados (somente administradores).
  todos: z.enum(["true", "false"]).optional(),
});

export const salvarItemSchema = z.object({
  nome: z.string().trim().min(2).max(80),
  descricao: z.string().trim().max(500).default(""),
  preco: z.number().int().min(1).max(100000),
  icone: z.string().trim().max(40).default("star"),
  cor: z.string().trim().regex(/^#[0-9A-Fa-f]{6}$/, "Use uma cor no formato #RRGGBB."),
  categoria: z.string().trim().min(2).max(40),
  efeito: efeitoItemSchema,
  valorEfeito: z.number().int().min(0).max(1000).default(0),
  duracaoMinutos: z.number().int().min(1).max(60 * 24 * 30).nullable().default(null),
  ativo: z.boolean().default(true),
}).superRefine((item, ctx) => {
  if (item.efeito === "BOOST_XP" && item.valorEfeito < 2) {
    ctx.addIssue({
      code: "custom",
      path: ["valorEfeito"],
      message: "O Boost de XP precisa de um multiplicador de pelo menos 2.",
    });
  }

  if (item.efeito === "TEMPO_EXTRA" && item.valorEfeito < 1) {
    ctx.addIssue({
      code: "custom",
      path: ["valorEfeito"],
      message: "Informe quantos minutos o Tempo Extra adiciona.",
    });
  }

  if (
    (item.efeito === "BOOST_XP" || item.efeito === "ESCUDO_SEQUENCIA") &&
    !item.duracaoMinutos
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["duracaoMinutos"],
      message: "Itens temporários precisam de uma duração em minutos.",
    });
  }
});

export const idItemSchema = z.object({ id: z.string().uuid() });

export const comprarSchema = z.object({
  quantidade: z.number().int().min(1).max(20).default(1),
});

export type SalvarItemInput = z.infer<typeof salvarItemSchema>;
export type ListarItensQuery = z.infer<typeof listarItensQuerySchema>;
