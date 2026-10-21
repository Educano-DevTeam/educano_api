
import type { Request, Response } from "express";
import { prisma } from "../../../config/prisma.js";

export async function consultarSessao(
  req: Request,
  res: Response,
) {
  // O middleware autenticar já validou o token e a conta.
  const idUsuario = req.usuarioAutenticado!.id;

  try {
    const usuario = await prisma.usuario.findUnique({
      where: { id: idUsuario },
      select: {
        id: true,
        nome: true,
        email: true,
        tipo: true,
        status: true,
        perfil: {
          select: {
            tipoPerfil: true,
            xp: true,
            moedas: true,
            nivel: true,
            cor: true,
            urlFotoPerfil: true,
            urlFotoBackground: true,
          },
        },
      },
    });

    // Verificação adicional para manter a resposta consistente.
    if (!usuario || usuario.status !== "ATIVO") {
      return res.status(401).json({
        message: "Conta indisponível ou sessão inválida.",
      });
    }

    return res.status(200).json({
      autenticado: true,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo,
        status: usuario.status,
      },
      perfil: usuario.perfil,
    });
  } catch (error) {
    console.error("Erro ao consultar a sessão:", error);

    return res.status(503).json({
      message: "Não foi possível consultar a sessão no momento.",
    });
  }
}
