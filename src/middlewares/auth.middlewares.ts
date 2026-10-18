import type {
  Request,
  Response,
  NextFunction,
} from "express";

import { prisma } from "../config/prisma.js";
import { verificarToken } from "../modules/auth/services/token.service.js";

/**
 * Informações mínimas do usuário autenticado disponíveis
 * para controllers e outros middlewares.
 */
declare global {
  namespace Express {
    interface Request {
      usuarioAutenticado?: {
        id: string;
        tipo: "ALUNO" | "PROFESSOR" | "PARCEIRO" | "ADMIN";
      };
    }
  }
}

export async function autenticar(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({
      message: "Autenticação necessária.",
    });
  }

  const token = authorization.slice("Bearer ".length).trim();

  if (!token) {
    return res.status(401).json({
      message: "Token não informado.",
    });
  }

  try {
    const idUsuario = verificarToken(token);

    // Confere o estado atual da conta no banco, em vez de
    // confiar apenas nas informações de um token antigo.
    const usuario = await prisma.usuario.findUnique({
      where: { id: idUsuario },
      select: {
        id: true,
        tipo: true,
        status: true,
      },
    });

    if (!usuario || usuario.status !== "ATIVO") {
      return res.status(401).json({
        message: "Conta indisponível ou sessão inválida.",
      });
    }

    req.usuarioAutenticado = {
      id: usuario.id,
      tipo: usuario.tipo,
    };

    return next();
  } catch {
    return res.status(401).json({
      message: "Token inválido ou expirado.",
    });
  }
}

/**
 * Restringe a rota a administradores.
 * Deve ser usado depois do middleware autenticar.
 */
export function exigirAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!req.usuarioAutenticado) {
    return res.status(401).json({
      message: "Autenticação necessária.",
    });
  }

  if (req.usuarioAutenticado.tipo !== "ADMIN") {
    return res.status(403).json({
      message: "Você não tem permissão para executar esta ação.",
    });
  }

  return next();
}