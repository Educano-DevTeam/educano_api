
import type { Request, Response, NextFunction } from "express";
import { prisma } from "../config/prisma.js";
import { verificarToken } from "../modules/auth/services/token.service.js";

type TipoUsuarioAutenticado =
  | "ALUNO"
  | "PROFESSOR"
  | "PARCEIRO"
  | "ADMIN";

declare global {
  namespace Express {
    interface Request {
      usuarioAutenticado?: {
        id: string;
        tipo: TipoUsuarioAutenticado;
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

  // Erros na validação do JWT são erros de autenticação.
  let idUsuario: string;

  try {
    idUsuario = verificarToken(token);
  } catch {
    return res.status(401).json({
      message: "Token inválido ou expirado.",
    });
  }

  // A consulta ao banco fica fora do try/catch do JWT.
  // Assim, uma falha no banco não será tratada como token inválido.
  let usuario;

  try {
    usuario = await prisma.usuario.findUnique({
      where: { id: idUsuario },
      select: {
        id: true,
        tipo: true,
        status: true,
      },
    });
  } catch (error) {
    console.error("Falha ao consultar usuário no middleware:", error);

    return res.status(503).json({
      message: "Serviço temporariamente indisponível. Tente novamente.",
    });
  }

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
}

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
