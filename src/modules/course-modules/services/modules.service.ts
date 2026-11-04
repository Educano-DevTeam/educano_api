import { prisma } from "../../../config/prisma.js";
import type { UsuarioAutenticado } from "../../../shared/usuario.js";
import {
  cursoDaSessao,
  cursoDoModulo,
  exigirGestao,
} from "../../courses/services/acesso.service.js";
import type { CriarModuloInput } from "../types/modules.types.js";

export async function criarModulo(usuario: UsuarioAutenticado, dados: CriarModuloInput) {
  exigirGestao(usuario, await cursoDaSessao(dados.idSessao));

  return prisma.modulo.create({
    data: {
      idSessao: dados.idSessao,
      titulo: dados.titulo,
      descricao: dados.descricao || null,
      licaoTitulo: dados.licaoTitulo || null,
      xp: dados.xp,
      idResponsavel: usuario.id,
    },
  });
}

export async function excluirModulo(usuario: UsuarioAutenticado, id: string) {
  exigirGestao(usuario, await cursoDoModulo(id));
  await prisma.modulo.delete({ where: { id } });
}
