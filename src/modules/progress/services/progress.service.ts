import { prisma } from "../../../config/prisma.js";
import type { UsuarioAutenticado } from "../../../shared/usuario.js";
import { minhasInscricoes } from "../../enrollments/services/enrollments.service.js";
import { progressoNivel } from "./recompensas.service.js";

const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const MESES_NA_EVOLUCAO = 7;

function media(valores: number[]): number {
  if (valores.length === 0) return 0;
  return Math.round(valores.reduce((a, b) => a + b, 0) / valores.length);
}

const NOMES_MATERIAS: Record<string, string> = {
  LINGUAGENS: "Linguagens",
  EXATAS: "Matemática",
  CIENCIAS_HUMANAS: "Ciências Humanas",
  CIENCIAS_NATURAIS: "Ciências da Natureza",
  REDACAO: "Redação",
  VESTIBULAR: "Vestibular",
  TECNOLOGIA: "Tecnologia",
  INTELIGENCIA_ARTIFICIAL: "Inteligência Artificial",
  DESIGN: "Design",
  FINANCAS: "Finanças",
};

function agrupar(
  respostas: Array<{ correta: boolean | null; questao: { materia: string | null; tema: string | null } }>,
  chave: "materia" | "tema",
) {
  const grupos = new Map<string, { acertos: number; total: number }>();

  for (const resposta of respostas) {
    const valor = resposta.questao[chave];
    const nome = chave === "materia"
      ? (valor ? NOMES_MATERIAS[valor] ?? valor : "Geral")
      : valor || "Geral";
    const grupo = grupos.get(nome) ?? { acertos: 0, total: 0 };
    grupo.total += 1;
    if (resposta.correta) grupo.acertos += 1;
    grupos.set(nome, grupo);
  }

  return [...grupos.entries()]
    .map(([nome, g]) => ({
      nome,
      acertos: g.acertos,
      total: g.total,
      percentual: g.total === 0 ? 0 : g.acertos / g.total,
    }))
    .sort((a, b) => b.total - a.total);
}

/** Estatísticas, desempenho e progresso do usuário autenticado. */
export async function consultarProgresso(usuario: UsuarioAutenticado) {
  const agora = new Date();
  const inicioEvolucao = new Date(
    agora.getFullYear(),
    agora.getMonth() - (MESES_NA_EVOLUCAO - 1),
    1,
  );

  const [perfil, simulados, respostas, recentes, cursos] = await Promise.all([
    prisma.perfil.findUnique({
      where: { idUsuario: usuario.id },
      select: {
        xp: true,
        moedas: true,
        sequenciaDias: true,
        ultimaAtividadeEm: true,
        tipoPerfil: true,
        planoConta: { select: { id: true, nome: true } },
      },
    }),
    prisma.tentativaTeste.findMany({
      where: { idUsuario: usuario.id, status: "FINALIZADA" },
      select: { teste: { select: { tipo: true } }, nota: true, finalizadoEm: true },
    }),
    prisma.respostaTentativa.findMany({
      where: { tentativa: { idUsuario: usuario.id, status: "FINALIZADA" } },
      select: {
        correta: true,
        questao: { select: { materia: true, tema: true } },
      },
    }),
    prisma.movimentacaoRecompensa.findMany({
      where: { idUsuario: usuario.id },
      orderBy: { criadoEm: "desc" },
      take: 10,
      select: { origem: true, xp: true, moedas: true, criadoEm: true },
    }),
    minhasInscricoes(usuario),
  ]);

  const xp = perfil?.xp ?? 0;

  const posicaoRanking = perfil
    ? (await prisma.perfil.count({
        where: { xp: { gt: xp }, usuario: { status: "ATIVO" } },
      })) + 1
    : null;

  const notasSimulados = simulados.filter((s) => s.teste.tipo === "SIMULADO").map((s) => s.nota ?? 0);
  const notasAtividades = simulados.filter((s) => s.teste.tipo === "ATIVIDADE").map((s) => s.nota ?? 0);

  const evolucao = Array.from({ length: MESES_NA_EVOLUCAO }, (_, i) => {
    const mes = new Date(inicioEvolucao.getFullYear(), inicioEvolucao.getMonth() + i, 1);
    const doMes = simulados.filter(
      (s) =>
        s.finalizadoEm &&
        s.finalizadoEm.getFullYear() === mes.getFullYear() &&
        s.finalizadoEm.getMonth() === mes.getMonth(),
    );

    return {
      mes: MESES[mes.getMonth()],
      ano: mes.getFullYear(),
      simulados: media(doMes.filter((s) => s.teste.tipo === "SIMULADO").map((s) => s.nota ?? 0)),
      atividades: media(doMes.filter((s) => s.teste.tipo === "ATIVIDADE").map((s) => s.nota ?? 0)),
    };
  });

  return {
    perfil: {
      ...progressoNivel(xp),
      xp,
      moedas: perfil?.moedas ?? 0,
      sequenciaDias: perfil?.sequenciaDias ?? 0,
      ultimaAtividadeEm: perfil?.ultimaAtividadeEm ?? null,
      tipoPerfil: perfil?.tipoPerfil ?? "PRIVADO",
      plano: perfil?.planoConta ?? null,
      posicaoRanking,
    },
    cursos: {
      inscritos: cursos.length,
      concluidos: cursos.filter((c) => c.totalConteudos > 0 && c.progresso >= 1).length,
      lista: cursos,
    },
    simulados: {
      realizados: notasSimulados.length,
      mediaNota: media(notasSimulados),
      melhorNota: notasSimulados.length ? Math.max(...notasSimulados) : 0,
      atividadesRealizadas: notasAtividades.length,
      mediaAtividades: media(notasAtividades),
    },
    desempenho: {
      porMateria: agrupar(respostas, "materia"),
      porTema: agrupar(respostas, "tema"),
    },
    evolucao,
    recompensasRecentes: recentes,
  };
}
