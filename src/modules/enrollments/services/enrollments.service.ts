import { prisma } from "../../../config/prisma.js";
import { ErroServico, conflito, naoEncontrado } from "../../../shared/erros.js";
import type { UsuarioAutenticado } from "../../../shared/usuario.js";
import { buscarCurso, exigirGestao } from "../../courses/services/acesso.service.js";
import type { InscreverInput } from "../types/enrollments.types.js";

async function inscrever({ idUsuario, idCurso, turma }: InscreverInput) {
  return prisma.$transaction(async (tx) => {
    const curso = await tx.curso.findUnique({
      where: { id: idCurso },
      select: { id: true, nome: true, status: true, vagas: true },
    });

    if (!curso) throw naoEncontrado("Curso não encontrado.");

    if (curso.status !== "ATIVO") {
      throw new ErroServico(
        400,
        "CURSO_INDISPONIVEL",
        "Este curso não está disponível para inscrições.",
      );
    }

    const existente = await tx.inscricao.findUnique({
      where: { idUsuario_idCurso: { idUsuario, idCurso } },
      select: { id: true },
    });

    if (existente) throw conflito("O usuário já está inscrito neste curso.");

    // Sem número de vagas definido, o curso não tem limite.
    if (curso.vagas !== null) {
      const inscritos = await tx.inscricao.count({ where: { idCurso } });

      if (inscritos >= curso.vagas) {
        throw new ErroServico(
          409,
          "CURSO_SEM_VAGAS",
          "Este curso já atingiu o número máximo de vagas.",
        );
      }
    }

    const inscricao = await tx.inscricao.create({
      data: { idUsuario, idCurso, turma },
    });

    return { ...inscricao, curso: { id: curso.id, nome: curso.nome } };
  });
}

export function inscreverSe(
  usuario: UsuarioAutenticado,
  idCurso: string,
  turma: InscreverInput["turma"],
) {
  return inscrever({ idUsuario: usuario.id, idCurso, turma });
}

export async function inscreverUsuario(
  solicitante: UsuarioAutenticado,
  idCurso: string,
  email: string,
  turma: InscreverInput["turma"],
) {
  exigirGestao(solicitante, await buscarCurso(idCurso));

  const aluno = await prisma.usuario.findUnique({
    where: { email: email.toLowerCase() },
    select: { id: true, nome: true, email: true, status: true },
  });

  if (!aluno) throw naoEncontrado("Não existe uma conta cadastrada com esse e-mail.");

  if (aluno.status !== "ATIVO") {
    throw new ErroServico(400, "CONTA_INATIVA", "A conta desse usuário não está ativa.");
  }

  const inscricao = await inscrever({ idUsuario: aluno.id, idCurso, turma });

  return { ...inscricao, usuario: { id: aluno.id, nome: aluno.nome, email: aluno.email } };
}

export async function cancelarInscricao(usuario: UsuarioAutenticado, idCurso: string) {
  const resultado = await prisma.inscricao.deleteMany({
    where: { idUsuario: usuario.id, idCurso },
  });

  if (resultado.count === 0) throw naoEncontrado("Você não está inscrito neste curso.");
}

export async function listarInscritos(usuario: UsuarioAutenticado, idCurso: string) {
  exigirGestao(usuario, await buscarCurso(idCurso));

  return prisma.inscricao.findMany({
    where: { idCurso },
    orderBy: { criadoEm: "desc" },
    select: {
      turma: true,
      criadoEm: true,
      usuario: { select: { id: true, nome: true, email: true } },
    },
  });
}

/** Cursos em que o usuário está inscrito, com o progresso de cada um. */
export async function minhasInscricoes(usuario: UsuarioAutenticado) {
  const inscricoes = await prisma.inscricao.findMany({
    where: { idUsuario: usuario.id },
    orderBy: { criadoEm: "desc" },
    select: {
      turma: true,
      criadoEm: true,
      curso: {
        select: {
          id: true,
          nome: true,
          descricao: true,
          categoria: true,
          status: true,
          cor: true,
          idCapa: true,
          iconeCapa: true,
          sessoes: {
            select: {
              modulos: {
                select: {
                  aulas: { select: { id: true, duracaoMinutos: true } },
                  testes: { where: { tipo: "ATIVIDADE" }, select: { id: true, tempoMinutos: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const modulos = inscricoes.flatMap((i) => i.curso.sessoes.flatMap((s) => s.modulos));
  const idsAulas = modulos.flatMap((m) => m.aulas.map((a) => a.id));
  const idsTestes = modulos.flatMap((m) => m.testes.map((t) => t.id));

  const [aulas, testes] = await Promise.all([
    prisma.progressoAula.findMany({
      where: { idUsuario: usuario.id, idAula: { in: idsAulas } },
      select: { idAula: true },
    }),
    prisma.tentativaTeste.findMany({
      where: { idUsuario: usuario.id, idTeste: { in: idsTestes }, status: "FINALIZADA" },
      distinct: ["idTeste"],
      select: { idTeste: true },
    }),
  ]);

  const concluidos = new Set([...aulas.map((a) => a.idAula), ...testes.map((t) => t.idTeste)]);

  return inscricoes.map(({ curso, turma, criadoEm }) => {
    const modulosCurso = curso.sessoes.flatMap((s) => s.modulos);
    const conteudos = modulosCurso.flatMap((m) => [
      ...m.aulas.map((a) => ({ id: a.id, minutos: a.duracaoMinutos ?? 0 })),
      ...m.testes.map((t) => ({ id: t.id, minutos: t.tempoMinutos })),
    ]);
    const feitos = conteudos.filter((c) => concluidos.has(c.id)).length;

    return {
      id: curso.id,
      nome: curso.nome,
      descricao: curso.descricao ?? "",
      categoria: curso.categoria,
      status: curso.status,
      cor: curso.cor,
      idCapa: curso.idCapa,
      iconeCapa: curso.iconeCapa,
      turma,
      inscritoEm: criadoEm,
      sessoes: curso.sessoes.length,
      cargaHorariaMinutos: conteudos.reduce((soma, c) => soma + c.minutos, 0),
      totalConteudos: conteudos.length,
      concluidos: feitos,
      progresso: conteudos.length === 0 ? 0 : feitos / conteudos.length,
    };
  });
}
