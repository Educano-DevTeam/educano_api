import { prisma } from "../../../config/prisma.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { conflito, naoEncontrado, semPermissao } from "../../../shared/erros.js";
import { montarPaginacao } from "../../../shared/paginacao.js";
import { ehAdmin, type UsuarioAutenticado } from "../../../shared/usuario.js";
import type {
  ListarQuestoesQuery,
  SalvarQuestaoInput,
} from "../types/questions.types.js";

const QUESTOES_POR_PAGINA = 15;

type Transacao = Prisma.TransactionClient;

const selecaoQuestao = {
  id: true,
  titulo: true,
  enunciado: true,
  dificuldade: true,
  materia: true,
  tema: true,
  explicacao: true,
  idAlternativaCorreta: true,
  criadoEm: true,
  atualizadoEm: true,
  responsavel: { select: { id: true, nome: true } },
  alternativas: {
    orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
    select: { id: true, texto: true, ordem: true },
  },
  _count: { select: { testes: true, respostas: true } },
} satisfies Prisma.QuestaoSelect;

type QuestaoSelecionada = Prisma.QuestaoGetPayload<{ select: typeof selecaoQuestao }>;

function formatar({ _count, idAlternativaCorreta, responsavel, ...questao }: QuestaoSelecionada) {
  return {
    ...questao,
    professor: responsavel,
    alternativas: questao.alternativas.map((alternativa) => ({
      ...alternativa,
      correta: alternativa.id === idAlternativaCorreta,
    })),
    uso: { testes: _count.testes, respostas: _count.respostas },
  };
}

export async function listarQuestoes(
  usuario: UsuarioAutenticado,
  filtros: ListarQuestoesQuery,
) {
  const where: Prisma.QuestaoWhereInput = {
    ...(filtros.dificuldade && { dificuldade: filtros.dificuldade }),
    ...(filtros.materia && { materia: filtros.materia }),
    ...(filtros.minhas === "true" && { idResponsavel: usuario.id }),
    ...(filtros.busca && {
      OR: [
        { titulo: { contains: filtros.busca, mode: "insensitive" } },
        { enunciado: { contains: filtros.busca, mode: "insensitive" } },
        { tema: { contains: filtros.busca, mode: "insensitive" } },
      ],
    }),
  };

  // O filtro pelo número de alternativas usa os IDs que atendem a ele.
  if (filtros.alternativas) {
    const grupos = await prisma.alternativa.groupBy({
      by: ["idQuestao"],
      _count: { _all: true },
      having: { idQuestao: { _count: { equals: filtros.alternativas } } },
    });

    where.id = { in: grupos.map((g) => g.idQuestao) };
  }

  const [questoes, total] = await prisma.$transaction([
    prisma.questao.findMany({
      where,
      skip: (filtros.page - 1) * QUESTOES_POR_PAGINA,
      take: QUESTOES_POR_PAGINA,
      orderBy: [{ criadoEm: "desc" }, { id: "asc" }],
      select: selecaoQuestao,
    }),
    prisma.questao.count({ where }),
  ]);

  return {
    dados: questoes.map(formatar),
    paginacao: montarPaginacao(filtros.page, QUESTOES_POR_PAGINA, total),
  };
}

export async function consultarQuestao(id: string) {
  const questao = await prisma.questao.findUnique({ where: { id }, select: selecaoQuestao });

  if (!questao) throw naoEncontrado("Questão não encontrada.");

  return formatar(questao);
}

function contar(grupo: { _count?: true | { _all?: number } }) {
  return typeof grupo._count === "object" ? grupo._count._all ?? 0 : 0;
}

/** Relatório das questões cadastradas para o dashboard. */
export async function relatorioQuestoes() {
  const [total, porDificuldade, porMateria, porResponsavel, respostas, maisUsadas] =
    await prisma.$transaction([
      prisma.questao.count(),
      prisma.questao.groupBy({
        by: ["dificuldade"],
        orderBy: { dificuldade: "asc" },
        _count: { _all: true },
      }),
      prisma.questao.groupBy({
        by: ["materia"],
        orderBy: { materia: "asc" },
        _count: { _all: true },
      }),
      prisma.questao.groupBy({
        by: ["idResponsavel"],
        orderBy: { idResponsavel: "asc" },
        _count: { _all: true },
      }),
      prisma.respostaTentativa.groupBy({
        by: ["correta"],
        where: { correta: { not: null } },
        orderBy: { correta: "asc" },
        _count: { _all: true },
      }),
      prisma.questao.findMany({
        take: 5,
        orderBy: { respostas: { _count: "desc" } },
        select: {
          id: true,
          titulo: true,
          materia: true,
          _count: { select: { respostas: true } },
        },
      }),
    ]);

  const professores = await prisma.usuario.findMany({
    where: { id: { in: porResponsavel.map((g) => g.idResponsavel) } },
    select: { id: true, nome: true },
  });

  const acertos = contar(respostas.find((r) => r.correta === true) ?? {});
  const totalRespostas = acertos + contar(respostas.find((r) => r.correta === false) ?? {});

  return {
    total,
    porDificuldade: porDificuldade.map((g) => ({ dificuldade: g.dificuldade, total: contar(g) })),
    porMateria: porMateria.map((g) => ({ materia: g.materia, total: contar(g) })),
    porProfessor: porResponsavel.map((g) => ({
      professor: professores.find((p) => p.id === g.idResponsavel) ?? null,
      total: contar(g),
    })),
    respostas: {
      total: totalRespostas,
      acertos,
      taxaAcerto: totalRespostas === 0 ? 0 : acertos / totalRespostas,
    },
    maisUsadas: maisUsadas.map((q) => ({
      id: q.id,
      titulo: q.titulo,
      materia: q.materia,
      usos: q._count.respostas,
    })),
  };
}

async function exigirResponsavel(usuario: UsuarioAutenticado, id: string) {
  const questao = await prisma.questao.findUnique({
    where: { id },
    select: { id: true, idResponsavel: true },
  });

  if (!questao) throw naoEncontrado("Questão não encontrada.");

  // Só o professor responsável ou um administrador altera a questão.
  if (!ehAdmin(usuario) && questao.idResponsavel !== usuario.id) {
    throw semPermissao("Somente o professor responsável pode alterar esta questão.");
  }
}

function dadosQuestao(dados: SalvarQuestaoInput) {
  return {
    titulo: dados.titulo,
    enunciado: dados.enunciado,
    dificuldade: dados.dificuldade,
    materia: dados.materia,
    tema: dados.tema || null,
    explicacao: dados.explicacao || null,
  };
}

/** Grava as alternativas e aponta a correta na questão. */
async function salvarAlternativas(
  tx: Transacao,
  usuario: UsuarioAutenticado,
  idQuestao: string,
  alternativas: SalvarQuestaoInput["alternativas"],
) {
  const atuais = await tx.alternativa.findMany({
    where: { idQuestao },
    select: { id: true },
  });
  const idsAtuais = new Set(atuais.map((a) => a.id));
  const mantidas = new Set(
    alternativas.flatMap((a) => (a.id && idsAtuais.has(a.id) ? [a.id] : [])),
  );

  await tx.questao.update({ where: { id: idQuestao }, data: { idAlternativaCorreta: null } });
  await tx.alternativa.deleteMany({ where: { idQuestao, id: { notIn: [...mantidas] } } });

  let idCorreta: string | null = null;

  for (const [ordem, alternativa] of alternativas.entries()) {
    let id: string;

    if (alternativa.id && mantidas.has(alternativa.id)) {
      id = alternativa.id;
      await tx.alternativa.update({ where: { id }, data: { texto: alternativa.texto, ordem } });
    } else {
      const criada = await tx.alternativa.create({
        data: { idQuestao, idResponsavel: usuario.id, texto: alternativa.texto, ordem },
        select: { id: true },
      });
      id = criada.id;
    }

    if (alternativa.correta) idCorreta = id;
  }

  await tx.questao.update({ where: { id: idQuestao }, data: { idAlternativaCorreta: idCorreta } });
}

export async function criarQuestao(usuario: UsuarioAutenticado, dados: SalvarQuestaoInput) {
  const id = await prisma.$transaction(async (tx) => {
    const questao = await tx.questao.create({
      data: { ...dadosQuestao(dados), idResponsavel: usuario.id },
      select: { id: true },
    });

    await salvarAlternativas(tx, usuario, questao.id, dados.alternativas);
    return questao.id;
  });

  return consultarQuestao(id);
}

export async function atualizarQuestao(
  usuario: UsuarioAutenticado,
  id: string,
  dados: SalvarQuestaoInput,
) {
  await exigirResponsavel(usuario, id);

  await prisma.$transaction(async (tx) => {
    await tx.questao.update({ where: { id }, data: dadosQuestao(dados) });
    await salvarAlternativas(tx, usuario, id, dados.alternativas);
  });

  return consultarQuestao(id);
}

export async function excluirQuestao(usuario: UsuarioAutenticado, id: string) {
  await exigirResponsavel(usuario, id);

  const usos = await prisma.respostaTentativa.count({ where: { idQuestao: id } });

  if (usos > 0) {
    throw conflito(
      "Esta questão já foi respondida em simulados e não pode ser excluída. " +
      "Edite o conteúdo, se necessário.",
    );
  }

  await prisma.questao.delete({ where: { id } });
}
