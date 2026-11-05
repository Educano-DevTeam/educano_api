import { z } from "zod";

import { TipoMaterial } from "../../../generated/prisma/client.js";

const uuidSchema = z.string().uuid("Identificador inválido.");

const numeroOpcional = z.preprocess(
    (valor) => {
        if (valor === "" || valor === undefined || valor === null) {
            return undefined;
        }

        return Number(valor);
    },
    z.number().int().positive().optional(),
);

export const criarAulaSchema = z.object({
    idModulo: uuidSchema,

    titulo: z.string()
        .trim()
        .min(1, "O título é obrigatório.")
        .max(150),

    descricao: z.string()
        .trim()
        .optional(),

    tipo: z.nativeEnum(TipoMaterial),

    quantidadePaginas: numeroOpcional,

    duracaoMinutos: numeroOpcional,
}).superRefine((dados, contexto) => {
    if (
        dados.tipo === "PDF" &&
        !dados.quantidadePaginas
    ) {
        contexto.addIssue({
            code: "custom",
            path: ["quantidadePaginas"],
            message: "Informe a quantidade de páginas do PDF.",
        });
    }

    if (
        (dados.tipo === "VIDEO" || dados.tipo === "AUDIO") &&
        !dados.duracaoMinutos
    ) {
        contexto.addIssue({
            code: "custom",
            path: ["duracaoMinutos"],
            message: "Informe a duração do material em minutos.",
        });
    }

    if (
        dados.tipo !== "PDF" &&
        dados.quantidadePaginas !== undefined
    ) {
        contexto.addIssue({
            code: "custom",
            path: ["quantidadePaginas"],
            message: "A quantidade de páginas só pode ser informada para PDFs.",
        });
    }

    if (
        dados.tipo !== "VIDEO" &&
        dados.tipo !== "AUDIO" &&
        dados.duracaoMinutos !== undefined
    ) {
        contexto.addIssue({
            code: "custom",
            path: ["duracaoMinutos"],
            message: "A duração só pode ser informada para vídeos e áudios.",
        });
    }
});

export const atualizarAulaSchema = z.object({
    titulo: z.string()
        .trim()
        .min(1)
        .max(150)
        .optional(),

    descricao: z.string()
        .trim()
        .nullable()
        .optional(),
}).refine(
    (dados) => Object.keys(dados).length > 0,
    "Informe pelo menos um campo para atualizar.",
);

export const idAulaParamsSchema = z.object({
    id: uuidSchema,
});

export const listarAulasQuerySchema = z.object({
    idModulo: uuidSchema,
});