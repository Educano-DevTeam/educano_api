import { z } from "zod";
import {
    NivelDificuldade,
    TipoTeste,
} from "../../../generated/prisma/client.js";

const uuidSchema = z.string().uuid("Identificador inválido.");

const questaoIdsSchema = z.array(uuidSchema)
    .min(1, "Selecione pelo menos uma questão.")
    .max(100, "O limite é de 100 questões por atividade.")
    .superRefine((ids, contexto) => {
        if (new Set(ids).size !== ids.length) {
            contexto.addIssue({
                code: "custom",
                message: "Não é permitido repetir questões.",
            });
        }
    });

const tempoSchema = z.coerce.number()
    .int()
    .min(1, "O tempo mínimo é de 1 minuto.")
    .max(600, "O tempo máximo é de 600 minutos.");

const temaSchema = z.string()
    .trim()
    .max(150)
    .optional();

// Criação de atividade com questões previamente selecionadas.
export const criarAtividadeSchema = z.object({
    idModulo: uuidSchema,
    tema: temaSchema,
    tempoMinutos: tempoSchema,
    questaoIds: questaoIdsSchema,
});

// Criação de configuração de simulado personalizado.
export const criarSimuladoSchema = z.object({
    tema: temaSchema,
    tempoMinutos: tempoSchema,
    dificuldade: z.nativeEnum(NivelDificuldade),
    quantidadeQuestoes: z.coerce.number()
        .int()
        .min(1)
        .max(100),
});

// Atualização dos metadados ou questões de uma atividade.
export const atualizarTesteSchema = z.object({
    tema: z.string().trim().max(150).nullable().optional(),
    tempoMinutos: tempoSchema.optional(),
    questaoIds: questaoIdsSchema.optional(),
    dificuldade: z.nativeEnum(NivelDificuldade).optional(),
    quantidadeQuestoes: z.coerce.number()
        .int()
        .min(1)
        .max(100)
        .optional(),
}).refine(
    (dados) => Object.keys(dados).length > 0,
    "Informe pelo menos um campo para atualizar.",
);

export const idTesteParamsSchema = z.object({
    id: uuidSchema,
});

export const listarTestesQuerySchema = z.object({
    tipo: z.nativeEnum(TipoTeste).optional(),
    idModulo: uuidSchema.optional(),
    pagina: z.coerce.number().int().positive().default(1),
    limite: z.coerce.number().int().min(1).max(100).default(30),
});