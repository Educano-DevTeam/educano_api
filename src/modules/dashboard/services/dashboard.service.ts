import { prisma } from "../../../config/prisma.js";

const DIA_MS = 24 * 60 * 60 * 1000;

function contar(grupo: { _count?: true | { _all?: number } }): number {
  return typeof grupo._count === "object" ? grupo._count._all ?? 0 : 0;
}

/** Números gerais da plataforma para o painel administrativo. */
export async function resumoDashboard() {
  const agora = Date.now();
  const desde = (dias: number) => new Date(agora - dias * DIA_MS);

  const [
    porTipo,
    porStatus,
    novos30Dias,
    planos,
    semPlano,
    cursosPorStatus,
    inscricoesPorAluno,
    atividade,
    questoes,
    itens,
    simulados,
    recentes,
  ] = await Promise.all([
    prisma.usuario.groupBy({ by: ["tipo"], _count: { _all: true } }),
    prisma.usuario.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.usuario.count({ where: { criadoEm: { gte: desde(30) } } }),
    prisma.planoConta.findMany({
      orderBy: { ordem: "asc" },
      select: { nome: true, _count: { select: { perfis: true } } },
    }),
    prisma.perfil.count({ where: { planoContaId: null } }),
    prisma.curso.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.inscricao.groupBy({
      by: ["idUsuario"],
      _count: { _all: true },
    }),
    Promise.all([
      prisma.perfil.count({ where: { ultimaAtividadeEm: { gte: desde(1) } } }),
      prisma.perfil.count({ where: { ultimaAtividadeEm: { gte: desde(7), lt: desde(1) } } }),
      prisma.perfil.count({ where: { ultimaAtividadeEm: { gte: desde(15), lt: desde(7) } } }),
      prisma.perfil.count({ where: { ultimaAtividadeEm: { gte: desde(30), lt: desde(15) } } }),
      prisma.perfil.count({
        where: { OR: [{ ultimaAtividadeEm: { lt: desde(30) } }, { ultimaAtividadeEm: null }] },
      }),
    ]),
    prisma.questao.count(),
    prisma.item.count({ where: { ativo: true } }),
    prisma.tentativaTeste.count({ where: { status: "FINALIZADA" } }),
    Promise.all([
      prisma.usuario.findMany({
        orderBy: { criadoEm: "desc" },
        take: 3,
        select: { nome: true, criadoEm: true },
      }),
      prisma.curso.findMany({
        orderBy: { criadoEm: "desc" },
        take: 3,
        select: { nome: true, criadoEm: true },
      }),
      prisma.questao.findMany({
        orderBy: { criadoEm: "desc" },
        take: 3,
        select: { titulo: true, enunciado: true, criadoEm: true },
      }),
    ]),
  ]);

  const faixas = { "1 curso": 0, "2-3 cursos": 0, "4-5 cursos": 0, "6+ cursos": 0 };

  for (const aluno of inscricoesPorAluno) {
    const total = contar(aluno);
    if (total <= 1) faixas["1 curso"] += 1;
    else if (total <= 3) faixas["2-3 cursos"] += 1;
    else if (total <= 5) faixas["4-5 cursos"] += 1;
    else faixas["6+ cursos"] += 1;
  }

  const [usuarios, cursos, questoesRecentes] = recentes;

  const eventos = [
    ...usuarios.map((u) => ({ tipo: "USUARIO", descricao: `Novo usuário: ${u.nome}`, data: u.criadoEm })),
    ...cursos.map((c) => ({ tipo: "CURSO", descricao: `Curso cadastrado: ${c.nome}`, data: c.criadoEm })),
    ...questoesRecentes.map((q) => ({
      tipo: "QUESTAO",
      descricao: `Questão adicionada: ${q.titulo ?? q.enunciado.slice(0, 60)}`,
      data: q.criadoEm,
    })),
  ]
    .sort((a, b) => b.data.getTime() - a.data.getTime())
    .slice(0, 6);

  const [hoje, semana, quinzena, mes, inativos] = atividade;

  return {
    usuarios: {
      total: porTipo.reduce((soma, g) => soma + contar(g), 0),
      novosUltimos30Dias: novos30Dias,
      porTipo: porTipo.map((g) => ({ tipo: g.tipo, total: contar(g) })),
      porStatus: porStatus.map((g) => ({ status: g.status, total: contar(g) })),
    },
    planos: planos.map((p, indice) => ({
      nome: p.nome,
      // Perfis sem plano definido estão no plano gratuito.
      total: p._count.perfis + (indice === 0 ? semPlano : 0),
    })),
    cursos: {
      total: cursosPorStatus.reduce((soma, g) => soma + contar(g), 0),
      porStatus: cursosPorStatus.map((g) => ({ status: g.status, total: contar(g) })),
      inscricoesPorAluno: Object.entries(faixas).map(([faixa, total]) => ({ faixa, total })),
    },
    atividade: [
      { faixa: "Ativos hoje", total: hoje },
      { faixa: "Últimos 7 dias", total: semana },
      { faixa: "7–15 dias", total: quinzena },
      { faixa: "15–30 dias", total: mes },
      { faixa: "+30 dias", total: inativos },
    ],
    totais: { questoes, itensNaLoja: itens, simuladosFinalizados: simulados },
    eventosRecentes: eventos,
  };
}
