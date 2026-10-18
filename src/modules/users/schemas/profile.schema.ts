
import { z } from "zod";

// Campos que o próprio usuário pode personalizar.
// XP, moedas, nível e plano não são editáveis por esta rota.
export const editarPerfilSchema = z.object({
  tipoPerfil: z.enum(["PUBLICO", "PRIVADO"]).optional(),

  cor: z.string().trim().max(30).optional(),

  urlFotoPerfil: z.union([
    z.string().url().max(2048),
    z.literal(""),
  ]).optional(),

  urlFotoBackground: z.union([
    z.string().url().max(2048),
    z.literal(""),
  ]).optional(),
}).strict().refine(
  (dados) => Object.keys(dados).length > 0,
  {
    message: "Informe ao menos um campo para atualizar.",
  },
);

export type EditarPerfilInput = z.infer<
  typeof editarPerfilSchema
>;
