
import { prisma } from "../../../config/prisma.js";
import {
  consultarUsuario,
  UsersServiceError,
} from "./users.service.js";
import type { EditarPerfilInput } from "../schemas/profile.schema.js";

export class ProfileServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ProfileServiceError";
  }
}

export async function consultarPerfil(identifier: string) {
  const usuario = await consultarUsuario(identifier);

  const perfil = await prisma.perfil.findUnique({
    where: {
      idUsuario: usuario.id,
    },
    select: {
      idUsuario: true,
      tipoPerfil: true,
      planoContaId: true,
      xp: true,
      moedas: true,
      nivel: true,
      cor: true,
      decoracaoId: true,
      urlFotoPerfil: true,
      urlFotoBackground: true,
    },
  });

  if (!perfil) {
    throw new ProfileServiceError(
      "PERFIL_NAO_ENCONTRADO",
      "O perfil deste usuário não foi encontrado.",
    );
  }

  return perfil;
}

export async function editarPerfil(
  identifier: string,
  dados: EditarPerfilInput,
) {
  const usuario = await consultarUsuario(identifier);

  try {
    return await prisma.perfil.update({
      where: {
        idUsuario: usuario.id,
      },
      data: dados,
      select: {
        idUsuario: true,
        tipoPerfil: true,
        planoContaId: true,
        xp: true,
        moedas: true,
        nivel: true,
        cor: true,
        decoracaoId: true,
        urlFotoPerfil: true,
        urlFotoBackground: true,
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      throw new ProfileServiceError(
        "PERFIL_NAO_ENCONTRADO",
        "O perfil deste usuário não foi encontrado.",
      );
    }

    throw error;
  }
}

// Operação administrativa.
// O usuário continua existindo, mas ficará sem perfil.
export async function excluirPerfil(identifier: string) {
  const usuario = await consultarUsuario(identifier);

  try {
    await prisma.perfil.delete({
      where: {
        idUsuario: usuario.id,
      },
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      throw new ProfileServiceError(
        "PERFIL_NAO_ENCONTRADO",
        "O perfil deste usuário não foi encontrado.",
      );
    }

    throw error;
  }
}
