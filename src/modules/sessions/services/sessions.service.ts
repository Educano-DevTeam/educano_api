import { prisma } from "../../../config/prisma.js";
import type { UsuarioAutenticado } from "../../../shared/usuario.js";
import {
  buscarCurso,
  cursoDaSessao,
  exigirGestao,
} from "../../courses/services/acesso.service.js";
import type { CriarSessaoInput } from "../types/sessions.types.js";

export async function criarSessao(usuario: UsuarioAutenticado, dados: CriarSessaoInput) {
  exigirGestao(usuario, await buscarCurso(dados.idCurso));

  return prisma.sessao.create({
    data: {
      idCurso: dados.idCurso,
      titulo: dados.titulo,
      subtitulo: dados.subtitulo || null,
      descricao: dados.descricao || null,
      idResponsavel: usuario.id,
    },
  });
}

export async function excluirSessao(usuario: UsuarioAutenticado, id: string) {
  exigirGestao(usuario, await cursoDaSessao(id));
  await prisma.sessao.delete({ where: { id } });
}
