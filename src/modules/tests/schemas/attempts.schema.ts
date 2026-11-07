
import { z } from "zod";

const uuidSchema = z.string().uuid();

export const iniciarTentativaSchema = z.object({
    idTeste: uuidSchema,
});

export const enviarRespostasSchema = z.object({
    respostas: z.array(
        z.object({
            idQuestao: uuidSchema,
            resposta: z.enum(["A", "B", "C", "D", "E"]).nullable(),
        }),
    ),
});

export const idTentativaParamsSchema = z.object({
    id: uuidSchema,
});

export const listarTentativasQuerySchema = z.object({
    pagina: z.coerce.number().int().positive().default(1),
    limite: z.coerce.number().int().min(1).max(100).default(30),
});
