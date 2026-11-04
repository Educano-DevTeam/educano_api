import type { RequestHandler } from "express";
import { z } from "zod";

import { prisma } from "../../../config/prisma.js";
import { consultarArquivo } from "../services/files.service.js";

// Arquivos que podem ser exibidos sem login (fotos de perfil e capas).
const FINALIDADES_PUBLICAS = ["FOTO_PERFIL", "BACKGROUND_PERFIL", "CAPA_CURSO"] as const;

const paramsSchema = z.object({ id: z.string().uuid() });

// GET /api/media/:id
// Redireciona para uma URL assinada nova, para que o endereço salvo no
// perfil ou no curso continue funcionando depois que a assinatura expira.
export const redirecionarMidia: RequestHandler = async (req, res, next) => {
  try {
    const validacao = paramsSchema.safeParse(req.params);

    if (!validacao.success) {
      return res.status(404).json({ message: "Arquivo não encontrado." });
    }

    const registro = await prisma.arquivo.findUnique({
      where: { id: validacao.data.id },
      select: { finalidade: true },
    });

    if (
      !registro ||
      !(FINALIDADES_PUBLICAS as readonly string[]).includes(registro.finalidade)
    ) {
      return res.status(404).json({ message: "Arquivo não encontrado." });
    }

    const arquivo = await consultarArquivo(validacao.data.id);

    if (!arquivo) {
      return res.status(404).json({ message: "Arquivo não encontrado." });
    }

    res.setHeader("Cache-Control", "public, max-age=600");
    return res.redirect(302, arquivo.url);
  } catch (erro) {
    next(erro);
  }
};
