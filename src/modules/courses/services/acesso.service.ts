import { prisma } from "../../../config/prisma.js";
import { naoEncontrado, semPermissao } from "../../../shared/erros.js";
import { ehAdmin, type UsuarioAutenticado } from "../../../shared/usuario.js";

export interface CursoAcesso {
  id: string;
  idResponsavel: string;
  status: string;
}

const selecaoCurso = { id: true, idResponsavel: true, status: true } as const;

export function podeGerenciarCurso(
  usuario: UsuarioAutenticado,
  curso: { idResponsavel: string },
): boolean {
  return ehAdmin(usuario) || curso.idResponsavel === usuario.id;
}

export async function buscarCurso(idCurso: string): Promise<CursoAcesso> {
  const curso = await prisma.curso.findUnique({
    where: { id: idCurso },
    select: selecaoCurso,
  });

  if (!curso) throw naoEncontrado("Curso não encontrado.");

  return curso;
}

export async function cursoDaSessao(idSessao: string) {
  const sessao = await prisma.sessao.findUnique({
    where: { id: idSessao },
    select: { curso: { select: selecaoCurso } },
  });

  if (!sessao) throw naoEncontrado("Sessão não encontrada.");

  return sessao.curso;
}

export async function cursoDoModulo(idModulo: string) {
  const modulo = await prisma.modulo.findUnique({
    where: { id: idModulo },
    select: { sessao: { select: { curso: { select: selecaoCurso } } } },
  });

  if (!modulo) throw naoEncontrado("Módulo não encontrado.");

  return modulo.sessao.curso;
}

export function exigirGestao(usuario: UsuarioAutenticado, curso: CursoAcesso) {
  if (!podeGerenciarCurso(usuario, curso)) {
    throw semPermissao("Você não tem permissão para modificar este curso.");
  }
}

/**
 * Garante que o usuário pode acessar o conteúdo do curso:
 * quem gerencia o curso ou alunos inscritos em curso ativo.
 */
export async function exigirAcessoConteudo(
  usuario: UsuarioAutenticado,
  curso: CursoAcesso,
) {
  if (podeGerenciarCurso(usuario, curso)) return { gestor: true, inscrito: false };

  const inscricao = await prisma.inscricao.findUnique({
    where: { idUsuario_idCurso: { idUsuario: usuario.id, idCurso: curso.id } },
    select: { id: true },
  });

  if (!inscricao) {
    throw semPermissao("Inscreva-se no curso para acessar este conteúdo.");
  }

  if (curso.status !== "ATIVO") {
    throw semPermissao("Este curso está temporariamente indisponível.");
  }

  return { gestor: false, inscrito: true };
}
