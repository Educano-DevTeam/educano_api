import { z } from "zod";

import { NivelDificuldade } from "../../../generated/prisma/client.js";

const uuidSchema = z.string().uuid("Identificador inválido.");

const alternativaSchema = z.object({
    letra: z.enum(["A", "B", "C", "D", "E"]),

    texto: z.string()
        .trim()
        .min(1, "O texto da alternativa é obrigatório.")
        .max(5000),
});

const alternativasSchema = z.array(alternativaSchema)
    .min(2, "Informe pelo menos duas alternativas.")
    .max(5, "Uma questão pode ter no máximo cinco alternativas.")
    .superRefine((alternativas, contexto) => {
        const letras = alternativas.map((alternativa) => alternativa.letra);

        if (new Set(letras).size !== letras.length) {
            contexto.addIssue({
                code: "custom",
                message: "Não é permitido repetir letras nas alternativas.",
            });
        }
    });

export const criarQuestaoSchema = z.object({
    titulo: z.string()
        .trim()
        .max(150)
        .optional(),

    enunciado: z.string()
        .trim()
        .min(1, "O enunciado é obrigatório.")
        .max(20000),

    dificuldade: z.nativeEnum(NivelDificuldade)
        .default("MEDIO"),

    alternativas: alternativasSchema,

    letraCorreta: z.enum(["A", "B", "C", "D", "E"]),
}).superRefine((dados, contexto) => {
    const existeAlternativaCorreta = dados.alternativas.some(
        (alternativa) => alternativa.letra === dados.letraCorreta,
    );

    if (!existeAlternativaCorreta) {
        contexto.addIssue({
            code: "custom",
            path: ["letraCorreta"],
            message: "A alternativa correta precisa existir na questão.",
        });
    }
});

export const atualizarQuestaoSchema = z.object({
    titulo: z.string()
        .trim()
        .max(150)
        .nullable()
        .optional(),

    enunciado: z.string()
        .trim()
        .min(1)
        .max(20000)
        .optional(),

    dificuldade: z.nativeEnum(NivelDificuldade)
        .optional(),

    alternativas: alternativasSchema.optional(),

    letraCorreta: z.enum(["A", "B", "C", "D", "E"])
        .optional(),
}).superRefine((dados, contexto) => {
    if (Object.keys(dados).length === 0) {
        contexto.addIssue({
            code: "custom",
            message: "Informe pelo menos um campo para atualizar.",
        });
    }

    // Se as alternativas forem substituídas, a nova resposta correta
    // também deverá ser informada.
    if (dados.alternativas && !dados.letraCorreta) {
        contexto.addIssue({
            code: "custom",
            path: ["letraCorreta"],
            message: "Informe a nova alternativa correta.",
        });
    }

    if (dados.alternativas && dados.letraCorreta) {
        const existe = dados.alternativas.some(
            (alternativa) => alternativa.letra === dados.letraCorreta,
        );

        if (!existe) {
            contexto.addIssue({
                code: "custom",
                path: ["letraCorreta"],
                message: "A alternativa correta precisa existir na questão.",
            });
        }
    }
});

export const idQuestaoParamsSchema = z.object({
    id: uuidSchema,
});

export const listarQuestoesQuerySchema = z.object({
    dificuldade: z.nativeEnum(NivelDificuldade).optional(),

    busca: z.string().trim().max(150).optional(),

    pagina: z.coerce.number().int().positive().default(1),

    limite: z.coerce.number().int().min(1).max(100).default(30),
});