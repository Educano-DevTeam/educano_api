
import { Prisma } from "../../../generated/prisma/client.js";
import { obterBoostAtivo } from "../../items/services/items.service.js";

export type Recompensa = {
    moedas: number;
    xp: number;
};

/**
 * Verifica o inventário antes de conceder a recompensa.
 * Se houver um boost válido, aplica o multiplicador
 * tanto nas moedas quanto no XP.
 */
async function aplicarBoostNaRecompensa(
  tx: Prisma.TransactionClient,
  idUsuario: string,
  recompensaBase: Recompensa,
) {
  const boostAtivo = await obterBoostAtivo(tx, idUsuario);

  if (!boostAtivo) {
    return {
      recompensa: recompensaBase,
      boostAplicado: null,
    };
  }

  const multiplicador = boostAtivo.item.boost;

  return {
    recompensa: {
      moedas: Math.round(recompensaBase.moedas * multiplicador),
      xp: Math.round(recompensaBase.xp * multiplicador),
    },
    boostAplicado: {
      idInventario: boostAtivo.id,
      nome: boostAtivo.item.nome,
      multiplicador,
      expiraEm: boostAtivo.expiraEm,
    },
  };
}

const RECOMPENSAS_MATERIAL: Recompensa = {
    moedas: 2,
    xp: 5,
};

const RECOMPENSAS_TESTE = {
    ATIVIDADE: [
        { minimo: 0, moedas: 5, xp: 12 },
        { minimo: 50, moedas: 8, xp: 20 },
        { minimo: 70, moedas: 12, xp: 30 },
        { minimo: 85, moedas: 16, xp: 40 },
        { minimo: 95, moedas: 20, xp: 50 },
    ],
    SIMULADO: [
        { minimo: 0, moedas: 10, xp: 25 },
        { minimo: 50, moedas: 16, xp: 40 },
        { minimo: 70, moedas: 24, xp: 60 },
        { minimo: 85, moedas: 32, xp: 80 },
        { minimo: 95, moedas: 40, xp: 100 },
    ],
} as const;

const MULTIPLICADOR_DIFICULDADE = {
    FACIL: 1,
    MEDIO: 1.15,
    DIFICIL: 1.3,
} as const;

export async function registrarConclusaoMaterial(
  tx: Prisma.TransactionClient,
  idUsuario: string,
  idAula: string,
) {
  const resultado = await tx.progresso.createMany({
    data: [{
      idUsuario,
      idAula,
      concluida: true,
      concluidoEm: new Date(),
    }],
    skipDuplicates: true,
  });

  if (resultado.count === 0) {
    return {
      registrada: false,
      recompensa: { moedas: 0, xp: 0 },
      boostAplicado: null,
    };
  }

  const resultadoRecompensa = await aplicarBoostNaRecompensa(
    tx,
    idUsuario,
    RECOMPENSAS_MATERIAL,
  );

  await tx.perfil.update({
    where: { idUsuario },
    data: {
      moedas: {
        increment: resultadoRecompensa.recompensa.moedas,
      },
      xp: {
        increment: resultadoRecompensa.recompensa.xp,
      },
    },
  });

  return {
    registrada: true,
    recompensa: resultadoRecompensa.recompensa,
    boostAplicado: resultadoRecompensa.boostAplicado,
  };
}

export function calcularRecompensaTeste(params: {
    tipo: "ATIVIDADE" | "SIMULADO";
    nota: number;
    dificuldade: "FACIL" | "MEDIO" | "DIFICIL" | null;
    tempoConsumido: number | null;
    tempoLimiteMinutos: number;
}): Recompensa {
    const { tipo, nota, dificuldade, tempoConsumido, tempoLimiteMinutos } = params;

    const faixas = RECOMPENSAS_TESTE[tipo];

    const faixa = [...faixas]
        .reverse()
        .find((item) => nota >= item.minimo)!;

    const multiplicadorDificuldade =
        MULTIPLICADOR_DIFICULDADE[dificuldade ?? "MEDIO"];

    let multiplicadorTempo = 1;

    // O bônus de tempo só é aplicado para notas a partir de 70%.
    if (
        nota >= 70 &&
        tempoConsumido !== null &&
        tempoLimiteMinutos > 0
    ) {
        const proporcao = tempoConsumido / (tempoLimiteMinutos * 60);

        if (proporcao <= 0.5) {
            multiplicadorTempo = 1.2;
        } else if (proporcao <= 0.7) {
            multiplicadorTempo = 1.1;
        }
    }

    const multiplicador =
        multiplicadorDificuldade * multiplicadorTempo;

    return {
        moedas: Math.round(faixa.moedas * multiplicador),
        xp: Math.round(faixa.xp * multiplicador),
    };
}

export async function registrarConclusaoTeste(
  tx: Prisma.TransactionClient,
  params: {
    idUsuario: string;
    idTeste: string;
    tipo: "ATIVIDADE" | "SIMULADO";
    nota: number;
    dificuldade: "FACIL" | "MEDIO" | "DIFICIL" | null;
    tempoConsumido: number | null;
    tempoLimiteMinutos: number;
  },
) {
  const recompensaBase = calcularRecompensaTeste(params);

  const resultado = await tx.progresso.createMany({
    data: [{
      idUsuario: params.idUsuario,
      idTeste: params.idTeste,
      concluida: true,
      concluidoEm: new Date(),
    }],
    skipDuplicates: true,
  });

  if (resultado.count === 0) {
    return {
      registrada: false,
      recompensa: { moedas: 0, xp: 0 },
      boostAplicado: null,
    };
  }

  const resultadoRecompensa = await aplicarBoostNaRecompensa(
    tx,
    params.idUsuario,
    recompensaBase,
  );

  await tx.perfil.update({
    where: { idUsuario: params.idUsuario },
    data: {
      moedas: {
        increment: resultadoRecompensa.recompensa.moedas,
      },
      xp: {
        increment: resultadoRecompensa.recompensa.xp,
      },
    },
  });

  return {
    registrada: true,
    recompensa: resultadoRecompensa.recompensa,
    boostAplicado: resultadoRecompensa.boostAplicado,
  };
}