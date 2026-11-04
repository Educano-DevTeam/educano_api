import type { Prisma } from "../../../generated/prisma/client.js";

type Transacao = Prisma.TransactionClient;

type OrigemRecompensa =
  | "AULA"
  | "MODULO"
  | "ATIVIDADE"
  | "SIMULADO"
  | "COMPRA"
  | "AJUSTE";

export const XP_POR_NIVEL = 250;

// Regras de XP e moedas por atividade realizada.
export const REGRAS_RECOMPENSA = {
  aula: { xp: 10, moedas: 2 },
  atividadePorAcerto: { xp: 5, moedas: 1 },
  simuladoPorAcerto: { xp: 10, moedas: 2 },
  bonusSimuladoAprovado: { xp: 20, notaMinima: 70 },
  // Lição do módulo: o XP é definido no cadastro e as moedas são 1/5 dele.
  moedasPorXpModulo: 5,
} as const;

export function calcularNivel(xp: number): number {
  return Math.floor(Math.max(xp, 0) / XP_POR_NIVEL);
}

export function progressoNivel(xp: number) {
  const nivel = calcularNivel(xp);
  const inicio = nivel * XP_POR_NIVEL;

  return {
    nivel,
    xpNoNivel: xp - inicio,
    xpParaProximoNivel: XP_POR_NIVEL,
    proximoNivelEm: inicio + XP_POR_NIVEL,
  };
}

// Data no fuso de Brasília, usada para contar a sequência de dias de estudo.
function diaLocal(data: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
  }).format(data);
}

async function efeitoAtivo(
  tx: Transacao,
  idUsuario: string,
  efeito: "BOOST_XP" | "ESCUDO_SEQUENCIA",
  agora: Date,
) {
  return tx.ativacaoItem.findFirst({
    where: {
      idUsuario,
      status: "ATIVO",
      item: { efeito },
      OR: [{ expiraEm: null }, { expiraEm: { gt: agora } }],
    },
    orderBy: { ativadoEm: "desc" },
    select: { item: { select: { valorEfeito: true } } },
  });
}

function proximaSequencia(
  sequenciaAtual: number,
  ultimaAtividade: Date | null,
  agora: Date,
  protegida: boolean,
): number {
  if (!ultimaAtividade) return 1;

  const hoje = diaLocal(agora);
  const ultimoDia = diaLocal(ultimaAtividade);
  const ontem = diaLocal(new Date(agora.getTime() - 24 * 60 * 60 * 1000));

  if (ultimoDia === hoje) return Math.max(sequenciaAtual, 1);
  if (ultimoDia === ontem) return sequenciaAtual + 1;

  // O Escudo de Sequência mantém a sequência mesmo após um dia sem estudo.
  return protegida ? sequenciaAtual + 1 : 1;
}

interface ConcederRecompensaProps {
  idUsuario: string;
  origem: OrigemRecompensa;
  referencia?: string;
  xp: number;
  moedas: number;
}

/**
 * Credita XP e moedas no perfil, aplicando o Boost de XP ativo, atualiza o
 * nível e a sequência de estudos e registra a movimentação.
 * Deve ser chamada dentro da transação da atividade que gerou a recompensa.
 */
export async function concederRecompensa(
  tx: Transacao,
  { idUsuario, origem, referencia, xp, moedas }: ConcederRecompensaProps,
) {
  const agora = new Date();
  const contaComoEstudo = origem !== "COMPRA" && origem !== "AJUSTE";

  let multiplicador = 1;

  if (contaComoEstudo && xp > 0) {
    const boost = await efeitoAtivo(tx, idUsuario, "BOOST_XP", agora);
    multiplicador = Math.max(boost?.item.valorEfeito ?? 1, 1);
  }

  const xpFinal = xp * multiplicador;

  const perfil = await tx.perfil.upsert({
    where: { idUsuario },
    create: { idUsuario },
    update: {},
    select: {
      xp: true,
      moedas: true,
      sequenciaDias: true,
      ultimaAtividadeEm: true,
    },
  });

  if (perfil.moedas + moedas < 0) {
    throw new Error("Saldo de moedas insuficiente para a movimentação.");
  }

  let sequenciaDias = perfil.sequenciaDias;

  if (contaComoEstudo) {
    const escudo = await efeitoAtivo(tx, idUsuario, "ESCUDO_SEQUENCIA", agora);
    sequenciaDias = proximaSequencia(
      perfil.sequenciaDias,
      perfil.ultimaAtividadeEm,
      agora,
      Boolean(escudo),
    );
  }

  const novoXp = perfil.xp + xpFinal;

  const atualizado = await tx.perfil.update({
    where: { idUsuario },
    data: {
      xp: novoXp,
      moedas: { increment: moedas },
      nivel: calcularNivel(novoXp),
      ...(contaComoEstudo && {
        sequenciaDias,
        ultimaAtividadeEm: agora,
      }),
    },
    select: { xp: true, moedas: true, nivel: true, sequenciaDias: true },
  });

  if (xpFinal !== 0 || moedas !== 0) {
    await tx.movimentacaoRecompensa.create({
      data: {
        idUsuario,
        origem,
        referencia: referencia ?? null,
        xp: xpFinal,
        moedas,
      },
    });
  }

  return {
    xp: xpFinal,
    moedas,
    multiplicadorXp: multiplicador,
    perfil: atualizado,
  };
}
