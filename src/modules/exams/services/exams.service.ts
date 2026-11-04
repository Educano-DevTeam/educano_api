import { randomInt } from "node:crypto";
import { prisma } from "../../../config/prisma.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { ErroServico, naoEncontrado } from "../../../shared/erros.js";
import { montarPaginacao } from "../../../shared/paginacao.js";
import type { UsuarioAutenticado } from "../../../shared/usuario.js";
import { exigirAcessoConteudo } from "../../courses/services/acesso.service.js";
import { verificarModuloConcluido } from "../../lessons/services/lessons.service.js";
import {
  REGRAS_RECOMPENSA,
  concederRecompensa,
} from "../../progress/services/recompensas.service.js";
import type { GerarSimuladoInput } from "../schemas/exams.schema.js";

const MINUTOS_POR_QUESTAO = 2.5;
// Tolerância para respostas enviadas no último segundo.
const TOLERANCIA_SEGUNDOS = 30;
const SIMULADOS_POR_PAGINA = 10;

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

function embaralhar<T>(itens: T[]): T[] {
  const copia = [...itens];

  for (let i = copia.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }

  return copia;
}

function fimDoTempo(tentativa: { iniciadoEm: Date; tempoMinutos: number }): Date {
  return new Date(tentativa.iniciadoEm.getTime() + tentativa.tempoMinutos * 60 * 1000);
}

function inicioDoMes(agora: Date): Date {
  return new Date(agora.getFullYear(), agora.getMonth(), 1);
}

async function verificarLimitePlano(idUsuario: string) {
  const perfil = await prisma.perfil.findUnique({
    where: { idUsuario },
    select: { planoConta: { select: { nome: true, limiteSimuladosMes: true } } },
  });

  // Sem plano definido, vale o plano gratuito.
  const plano = perfil?.planoConta ?? await prisma.planoConta.findFirst({
    orderBy: { ordem: "asc" },
    select: { nome: true, limiteSimuladosMes: true },
  });

  if (!plano?.limiteSimuladosMes) return;

  const realizados = await prisma.tentativaTeste.count({
    where: {
      idUsuario,
      teste: { tipo: "SIMULADO" },
      iniciadoEm: { gte: inicioDoMes(new Date()) },
    },
  });

  if (realizados >= plano.limiteSimuladosMes) {
    throw new ErroServico(
      403,
      "LIMITE_DO_PLANO",
      `O plano ${plano.nome} permite ${plano.limiteSimuladosMes} simulados por mês. ` +
      "Faça upgrade para continuar praticando.",
    );
  }
}

/** Consome um Tempo Extra ativado no inventário, se houver. */
async function consumirTempoExtra(
  tx: Prisma.TransactionClient,
  idUsuario: string,
): Promise<number> {
  const ativacao = await tx.ativacaoItem.findFirst({
    where: { idUsuario, status: "ATIVO", item: { efeito: "TEMPO_EXTRA" } },
    orderBy: { ativadoEm: "asc" },
    select: { id: true, item: { select: { valorEfeito: true } } },
  });

  if (!ativacao) return 0;

  await tx.ativacaoItem.update({ where: { id: ativacao.id }, data: { status: "CONSUMIDO" } });

  return ativacao.item.valorEfeito;
}

/**
 * Gera um simulado com questões sorteadas conforme as configurações:
 * cria o teste do tipo SIMULADO e a tentativa do usuário.
 */
export async function gerarSimulado(usuario: UsuarioAutenticado, dados: GerarSimuladoInput) {
  await verificarLimitePlano(usuario.id);

  const candidatas = await prisma.questao.findMany({
    where: {
      materia: { in: dados.materias },
      ...(dados.dificuldade && { dificuldade: dados.dificuldade }),
      idAlternativaCorreta: { not: null },
    },
    select: { id: true },
  });

  if (candidatas.length < dados.quantidade) {
    throw new ErroServico(
      422,
      "QUESTOES_INSUFICIENTES",
      candidatas.length === 0
        ? "Ainda não há questões cadastradas para essas configurações."
        : `Há apenas ${candidatas.length} questão(ões) disponível(is) para essas ` +
          "configurações. Reduza a quantidade ou escolha outras matérias.",
    );
  }

  const selecionadas = embaralhar(candidatas).slice(0, dados.quantidade);
  const nomes = dados.materias.map((m) => NOMES_MATERIAS[m] ?? m).join(", ");

  const id = await prisma.$transaction(async (tx) => {
    const tempoExtra = await consumirTempoExtra(tx, usuario.id);
    const tempoMinutos = Math.round(dados.quantidade * MINUTOS_POR_QUESTAO) + tempoExtra;

    const teste = await tx.teste.create({
      data: {
        tipo: "SIMULADO",
        idResponsavel: usuario.id,
        tema: `Simulado de ${nomes}`,
        tempoMinutos,
        quantidadeQuestoes: selecionadas.length,
        questoes: {
          create: selecionadas.map((questao, ordem) => ({ idQuestao: questao.id, ordem })),
        },
      },
      select: { id: true },
    });

    const tentativa = await tx.tentativaTeste.create({
      data: {
        idTeste: teste.id,
        idUsuario: usuario.id,
        materias: dados.materias,
        dificuldade: dados.dificuldade ?? null,
        tempoMinutos,
        total: selecionadas.length,
        respostas: {
          create: selecionadas.map((questao, ordem) => ({ idQuestao: questao.id, ordem })),
        },
      },
      select: { id: true },
    });

    return tentativa.id;
  });

  return consultarSimulado(usuario, id);
}

/** Inicia uma tentativa da atividade de um módulo do curso. */
export async function iniciarAtividade(usuario: UsuarioAutenticado, idTeste: string) {
  const teste = await prisma.teste.findUnique({
    where: { id: idTeste },
    select: {
      id: true,
      tipo: true,
      tempoMinutos: true,
      questoes: { orderBy: { ordem: "asc" }, select: { idQuestao: true } },
      modulo: {
        select: {
          sessao: {
            select: { curso: { select: { id: true, idResponsavel: true, status: true } } },
          },
        },
      },
    },
  });

  if (!teste || teste.tipo !== "ATIVIDADE" || !teste.modulo) {
    throw naoEncontrado("Atividade não encontrada.");
  }

  await exigirAcessoConteudo(usuario, teste.modulo.sessao.curso);

  if (teste.questoes.length === 0) {
    throw new ErroServico(
      422,
      "ATIVIDADE_SEM_QUESTOES",
      "Esta atividade ainda não possui questões.",
    );
  }

  const id = await prisma.$transaction(async (tx) => {
    const tempoExtra = await consumirTempoExtra(tx, usuario.id);

    const tentativa = await tx.tentativaTeste.create({
      data: {
        idTeste: teste.id,
        idUsuario: usuario.id,
        tempoMinutos: teste.tempoMinutos + tempoExtra,
        total: teste.questoes.length,
        respostas: {
          create: teste.questoes.map((questao, ordem) => ({
            idQuestao: questao.idQuestao,
            ordem,
          })),
        },
      },
      select: { id: true },
    });

    return tentativa.id;
  });

  return consultarSimulado(usuario, id);
}

const selecaoDetalhe = {
  id: true,
  idUsuario: true,
  status: true,
  materias: true,
  dificuldade: true,
  tempoMinutos: true,
  iniciadoEm: true,
  finalizadoEm: true,
  acertos: true,
  total: true,
  nota: true,
  xpGanho: true,
  moedasGanhas: true,
  teste: { select: { id: true, tipo: true, tema: true, idModulo: true } },
  respostas: {
    orderBy: { ordem: "asc" },
    select: {
      ordem: true,
      idAlternativa: true,
      correta: true,
      dicaUsada: true,
      questao: {
        select: {
          id: true,
          titulo: true,
          enunciado: true,
          dificuldade: true,
          materia: true,
          tema: true,
          explicacao: true,
          idAlternativaCorreta: true,
          alternativas: {
            orderBy: [{ ordem: "asc" }, { criadoEm: "asc" }],
            select: { id: true, texto: true, ordem: true },
          },
        },
      },
    },
  },
} satisfies Prisma.TentativaTesteSelect;

type TentativaDetalhe = Prisma.TentativaTesteGetPayload<{ select: typeof selecaoDetalhe }>;
type RespostaDetalhe = TentativaDetalhe["respostas"][number];

// Alternativa eliminada pela Dica Extra: sempre a mesma errada para a questão.
function alternativaEliminada(item: RespostaDetalhe): string | null {
  const erradas = item.questao.alternativas
    .filter((a) => a.id !== item.questao.idAlternativaCorreta && a.id !== item.idAlternativa)
    .map((a) => a.id)
    .sort();

  return erradas[0] ?? null;
}

function resumoPor(respostas: RespostaDetalhe[], chave: "materia" | "tema") {
  const grupos = new Map<string, { acertos: number; total: number }>();

  for (const item of respostas) {
    const valor = item.questao[chave];
    const nome = chave === "materia"
      ? (valor ? NOMES_MATERIAS[valor] ?? valor : "Geral")
      : valor || "Geral";
    const grupo = grupos.get(nome) ?? { acertos: 0, total: 0 };
    grupo.total += 1;
    if (item.correta) grupo.acertos += 1;
    grupos.set(nome, grupo);
  }

  return [...grupos.entries()].map(([nome, grupo]) => ({
    nome,
    acertos: grupo.acertos,
    total: grupo.total,
    percentual: grupo.total === 0 ? 0 : grupo.acertos / grupo.total,
  }));
}

function formatarSimulado(tentativa: TentativaDetalhe) {
  const finalizado = tentativa.status === "FINALIZADA";

  return {
    id: tentativa.id,
    idTeste: tentativa.teste.id,
    tipo: tentativa.teste.tipo,
    titulo: tentativa.teste.tema ?? "Simulado",
    materias: tentativa.materias,
    dificuldade: tentativa.dificuldade,
    duracaoMinutos: tentativa.tempoMinutos,
    status: finalizado ? "FINALIZADO" : "EM_ANDAMENTO",
    iniciadoEm: tentativa.iniciadoEm,
    finalizadoEm: tentativa.finalizadoEm,
    expiraEm: fimDoTempo(tentativa),
    tempoRestanteSegundos: finalizado
      ? 0
      : Math.max(0, Math.floor((fimDoTempo(tentativa).getTime() - Date.now()) / 1000)),
    total: tentativa.total,
    respondidas: tentativa.respostas.filter((r) => r.idAlternativa).length,
    questoes: tentativa.respostas.map((item) => ({
      id: item.questao.id,
      ordem: item.ordem,
      titulo: item.questao.titulo ?? `Questão ${item.ordem + 1}`,
      enunciado: item.questao.enunciado,
      dificuldade: item.questao.dificuldade,
      materia: item.questao.materia,
      tema: item.questao.tema ?? "",
      idAlternativaEscolhida: item.idAlternativa,
      idAlternativaEliminada: item.dicaUsada ? alternativaEliminada(item) : null,
      // O gabarito só é revelado depois da finalização.
      alternativas: item.questao.alternativas.map((alternativa) => ({
        id: alternativa.id,
        texto: alternativa.texto,
        ordem: alternativa.ordem,
        ...(finalizado && { correta: alternativa.id === item.questao.idAlternativaCorreta }),
      })),
      ...(finalizado && {
        acertou: item.correta ?? false,
        explicacao: item.questao.explicacao ?? "",
      }),
    })),
    resultado: finalizado
      ? {
          acertos: tentativa.acertos ?? 0,
          total: tentativa.total,
          nota: tentativa.nota ?? 0,
          xpGanho: tentativa.xpGanho,
          moedasGanhas: tentativa.moedasGanhas,
          porMateria: resumoPor(tentativa.respostas, "materia"),
          porTema: resumoPor(tentativa.respostas, "tema"),
        }
      : null,
  };
}

async function buscarPropria(usuario: UsuarioAutenticado, id: string) {
  const tentativa = await prisma.tentativaTeste.findUnique({
    where: { id },
    select: selecaoDetalhe,
  });

  // Tentativas de outros usuários não são reveladas.
  if (!tentativa || tentativa.idUsuario !== usuario.id) {
    throw naoEncontrado("Simulado não encontrado.");
  }

  return tentativa;
}

export async function consultarSimulado(usuario: UsuarioAutenticado, id: string) {
  return formatarSimulado(await buscarPropria(usuario, id));
}

function exigirEmAndamento(tentativa: TentativaDetalhe) {
  if (tentativa.status !== "EM_ANDAMENTO") {
    throw new ErroServico(
      409,
      "SIMULADO_FINALIZADO",
      "Este simulado já foi finalizado e as respostas não podem ser alteradas.",
    );
  }

  if (Date.now() > fimDoTempo(tentativa).getTime() + TOLERANCIA_SEGUNDOS * 1000) {
    throw new ErroServico(
      409,
      "TEMPO_ESGOTADO",
      "O tempo do simulado acabou. Finalize para ver o resultado.",
    );
  }
}

export async function responderQuestao(
  usuario: UsuarioAutenticado,
  id: string,
  idQuestao: string,
  idAlternativa: string | null,
) {
  const tentativa = await buscarPropria(usuario, id);
  exigirEmAndamento(tentativa);

  const item = tentativa.respostas.find((r) => r.questao.id === idQuestao);

  if (!item) throw naoEncontrado("Questão não pertence a este simulado.");

  if (idAlternativa && !item.questao.alternativas.some((a) => a.id === idAlternativa)) {
    throw new ErroServico(400, "ALTERNATIVA_INVALIDA", "A alternativa não pertence a esta questão.");
  }

  await prisma.respostaTentativa.update({
    where: { idTentativa_idQuestao: { idTentativa: id, idQuestao } },
    data: { idAlternativa, respondidaEm: idAlternativa ? new Date() : null },
  });

  return {
    idQuestao,
    idAlternativa,
    respondidas: tentativa.respostas.filter((r) =>
      r.questao.id === idQuestao ? Boolean(idAlternativa) : Boolean(r.idAlternativa),
    ).length,
  };
}

/** Usa uma Dica Extra do inventário para eliminar uma alternativa errada. */
export async function usarDica(usuario: UsuarioAutenticado, id: string, idQuestao: string) {
  const tentativa = await buscarPropria(usuario, id);
  exigirEmAndamento(tentativa);

  const item = tentativa.respostas.find((r) => r.questao.id === idQuestao);

  if (!item) throw naoEncontrado("Questão não pertence a este simulado.");

  if (!item.dicaUsada) {
    await prisma.$transaction(async (tx) => {
      const inventario = await tx.inventarioItem.findFirst({
        where: {
          idUsuario: usuario.id,
          quantidade: { gt: 0 },
          item: { efeito: "DICA_EXTRA" },
        },
        select: { idItem: true },
      });

      if (!inventario) {
        throw new ErroServico(400, "SEM_DICAS", "Você não tem Dica Extra no inventário. Compre na loja.");
      }

      await tx.inventarioItem.update({
        where: { idUsuario_idItem: { idUsuario: usuario.id, idItem: inventario.idItem } },
        data: { quantidade: { decrement: 1 } },
      });

      await tx.ativacaoItem.create({
        data: { idUsuario: usuario.id, idItem: inventario.idItem, status: "CONSUMIDO" },
      });

      await tx.respostaTentativa.update({
        where: { idTentativa_idQuestao: { idTentativa: id, idQuestao } },
        data: { dicaUsada: true },
      });
    });
  }

  return { idAlternativaEliminada: alternativaEliminada(item) };
}

/**
 * Corrige a tentativa, calcula a nota, credita as recompensas e, nas
 * atividades, verifica se o módulo do curso foi concluído.
 */
export async function finalizarSimulado(usuario: UsuarioAutenticado, id: string) {
  const tentativa = await buscarPropria(usuario, id);

  if (tentativa.status !== "EM_ANDAMENTO") return formatarSimulado(tentativa);

  const correcao = tentativa.respostas.map((item) => ({
    idQuestao: item.questao.id,
    correta: item.idAlternativa !== null && item.idAlternativa === item.questao.idAlternativaCorreta,
  }));

  const acertos = correcao.filter((c) => c.correta).length;
  const nota = tentativa.total === 0 ? 0 : Math.round((acertos / tentativa.total) * 100);
  const ehSimulado = tentativa.teste.tipo === "SIMULADO";

  await prisma.$transaction(async (tx) => {
    // A condição de status impede que a tentativa seja finalizada duas vezes.
    const bloqueio = await tx.tentativaTeste.updateMany({
      where: { id, status: "EM_ANDAMENTO" },
      data: { status: "FINALIZADA", finalizadoEm: new Date(), acertos, nota },
    });

    if (bloqueio.count !== 1) return;

    for (const item of correcao) {
      await tx.respostaTentativa.update({
        where: { idTentativa_idQuestao: { idTentativa: id, idQuestao: item.idQuestao } },
        data: { correta: item.correta },
      });
    }

    const regra = ehSimulado
      ? REGRAS_RECOMPENSA.simuladoPorAcerto
      : REGRAS_RECOMPENSA.atividadePorAcerto;

    let xp = acertos * regra.xp;
    const moedas = acertos * regra.moedas;

    if (ehSimulado && nota >= REGRAS_RECOMPENSA.bonusSimuladoAprovado.notaMinima) {
      xp += REGRAS_RECOMPENSA.bonusSimuladoAprovado.xp;
    }

    const recompensa = await concederRecompensa(tx, {
      idUsuario: usuario.id,
      origem: ehSimulado ? "SIMULADO" : "ATIVIDADE",
      referencia: id,
      xp,
      moedas,
    });

    let xpTotal = recompensa.xp;
    let moedasTotal = recompensa.moedas;

    // A atividade concluída pode fechar o módulo do curso.
    if (!ehSimulado && tentativa.teste.idModulo) {
      const modulo = await verificarModuloConcluido(tx, usuario.id, tentativa.teste.idModulo);
      xpTotal += modulo.xp;
      moedasTotal += modulo.moedas;
    }

    await tx.tentativaTeste.update({
      where: { id },
      data: { xpGanho: xpTotal, moedasGanhas: moedasTotal },
    });
  });

  return consultarSimulado(usuario, id);
}

export async function historicoSimulados(
  usuario: UsuarioAutenticado,
  page: number,
  tipo: "SIMULADO" | "ATIVIDADE",
) {
  const where = { idUsuario: usuario.id, teste: { tipo } };

  const [tentativas, total] = await prisma.$transaction([
    prisma.tentativaTeste.findMany({
      where,
      orderBy: [{ iniciadoEm: "desc" }, { id: "asc" }],
      skip: (page - 1) * SIMULADOS_POR_PAGINA,
      take: SIMULADOS_POR_PAGINA,
      select: {
        id: true,
        status: true,
        materias: true,
        dificuldade: true,
        iniciadoEm: true,
        finalizadoEm: true,
        tempoMinutos: true,
        acertos: true,
        total: true,
        nota: true,
        xpGanho: true,
        teste: { select: { tipo: true, tema: true } },
      },
    }),
    prisma.tentativaTeste.count({ where }),
  ]);

  return {
    dados: tentativas.map(({ teste, status, tempoMinutos, ...t }) => ({
      ...t,
      tipo: teste.tipo,
      titulo: teste.tema ?? "Simulado",
      materias: t.materias.map((m) => NOMES_MATERIAS[m] ?? m),
      duracaoMinutos: tempoMinutos,
      status: status === "FINALIZADA" ? "FINALIZADO" : "EM_ANDAMENTO",
      expirado: status === "EM_ANDAMENTO" &&
        fimDoTempo({ iniciadoEm: t.iniciadoEm, tempoMinutos }).getTime() < Date.now(),
    })),
    paginacao: montarPaginacao(page, SIMULADOS_POR_PAGINA, total),
  };
}
