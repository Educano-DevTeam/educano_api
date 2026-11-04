import { prisma } from "../../../config/prisma.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { ErroServico, naoEncontrado, semPermissao } from "../../../shared/erros.js";
import type { UsuarioAutenticado } from "../../../shared/usuario.js";
import {
  cursoDoModulo,
  exigirAcessoConteudo,
  exigirGestao,
} from "../../courses/services/acesso.service.js";
import { criarConteudo } from "../../courses/services/estrutura.service.js";
import { consultarArquivo } from "../../files/services/files.service.js";
import {
  REGRAS_RECOMPENSA,
  concederRecompensa,
} from "../../progress/services/recompensas.service.js";
import type { ConclusaoAula } from "../types/lessons.types.js";

type Transacao = Prisma.TransactionClient;

// Links de aulas valem tempo suficiente para assistir a uma aula longa.
const VALIDADE_LINK_SEGUNDOS = 3 * 60 * 60;

async function buscarAula(id: string) {
  const aula = await prisma.aula.findUnique({
    where: { id },
    select: {
      id: true,
      tipo: true,
      titulo: true,
      idModulo: true,
      idArquivo: true,
      modulo: {
        select: {
          sessao: {
            select: { curso: { select: { id: true, idResponsavel: true, status: true } } },
          },
        },
      },
    },
  });

  if (!aula) throw naoEncontrado("Aula não encontrada.");

  return { ...aula, curso: aula.modulo.sessao.curso };
}

export async function criarAula(
  usuario: UsuarioAutenticado,
  dados: Parameters<typeof criarConteudo>[3] & { idModulo: string },
) {
  exigirGestao(usuario, await cursoDoModulo(dados.idModulo));

  const criada = await prisma.$transaction((tx) =>
    criarConteudo(tx, usuario, dados.idModulo, dados),
  );

  return prisma.aula.findUniqueOrThrow({
    where: { id: criada.id },
    select: {
      id: true,
      titulo: true,
      descricao: true,
      tipo: true,
      duracaoMinutos: true,
      quantidadePaginas: true,
      idArquivo: true,
    },
  });
}

export async function excluirAula(usuario: UsuarioAutenticado, id: string) {
  const aula = await buscarAula(id);
  exigirGestao(usuario, aula.curso);
  await prisma.aula.delete({ where: { id } });
}

/**
 * Gera um link temporário para abrir o arquivo da aula.
 * O acesso é liberado para quem gerencia o curso ou está inscrito nele.
 */
export async function gerarAcessoAula(usuario: UsuarioAutenticado, id: string) {
  const aula = await buscarAula(id);

  await exigirAcessoConteudo(usuario, aula.curso);

  const arquivo = aula.idArquivo
    ? await consultarArquivo(aula.idArquivo, VALIDADE_LINK_SEGUNDOS)
    : null;

  if (!arquivo) {
    throw new ErroServico(400, "AULA_SEM_ARQUIVO", "Esta aula não possui arquivo disponível.");
  }

  return {
    url: arquivo.url,
    nomeArquivo: arquivo.nomeOriginal,
    contentType: arquivo.contentType,
    tamanhoBytes: arquivo.tamanhoBytes,
  };
}

/**
 * Credita o XP da lição quando todas as aulas e atividades do módulo foram
 * concluídas. O bônus é concedido uma única vez por módulo.
 */
export async function verificarModuloConcluido(
  tx: Transacao,
  idUsuario: string,
  idModulo: string,
) {
  const modulo = await tx.modulo.findUniqueOrThrow({
    where: { id: idModulo },
    select: {
      id: true,
      xp: true,
      aulas: { select: { id: true } },
      testes: { where: { tipo: "ATIVIDADE" }, select: { id: true } },
    },
  });

  const [aulasFeitas, testesFeitos] = await Promise.all([
    tx.progressoAula.count({
      where: { idUsuario, idAula: { in: modulo.aulas.map((a) => a.id) } },
    }),
    tx.tentativaTeste.findMany({
      where: {
        idUsuario,
        status: "FINALIZADA",
        idTeste: { in: modulo.testes.map((t) => t.id) },
      },
      distinct: ["idTeste"],
      select: { idTeste: true },
    }),
  ]);

  const concluido =
    aulasFeitas === modulo.aulas.length && testesFeitos.length === modulo.testes.length;

  if (!concluido || modulo.xp <= 0) return { concluido, xp: 0, moedas: 0 };

  const jaRecebeu = await tx.movimentacaoRecompensa.findFirst({
    where: { idUsuario, origem: "MODULO", referencia: modulo.id },
    select: { id: true },
  });

  if (jaRecebeu) return { concluido, xp: 0, moedas: 0 };

  const bonus = await concederRecompensa(tx, {
    idUsuario,
    origem: "MODULO",
    referencia: modulo.id,
    xp: modulo.xp,
    moedas: Math.ceil(modulo.xp / REGRAS_RECOMPENSA.moedasPorXpModulo),
  });

  return { concluido, xp: bonus.xp, moedas: bonus.moedas };
}

export async function concluirAula(
  usuario: UsuarioAutenticado,
  id: string,
): Promise<ConclusaoAula> {
  const aula = await buscarAula(id);
  const acesso = await exigirAcessoConteudo(usuario, aula.curso);

  // Quem gerencia o curso pode visualizar, mas o progresso é do aluno inscrito.
  if (acesso.gestor) {
    const inscrito = await prisma.inscricao.findUnique({
      where: { idUsuario_idCurso: { idUsuario: usuario.id, idCurso: aula.curso.id } },
      select: { id: true },
    });

    if (!inscrito) throw semPermissao("Inscreva-se no curso para registrar seu progresso.");
  }

  return prisma.$transaction(async (tx) => {
    const existente = await tx.progressoAula.findUnique({
      where: { idUsuario_idAula: { idUsuario: usuario.id, idAula: id } },
      select: { concluidoEm: true },
    });

    if (existente) return { novo: false, xp: 0, moedas: 0, moduloConcluido: false };

    await tx.progressoAula.create({ data: { idUsuario: usuario.id, idAula: id } });

    const recompensa = await concederRecompensa(tx, {
      idUsuario: usuario.id,
      origem: "AULA",
      referencia: id,
      xp: REGRAS_RECOMPENSA.aula.xp,
      moedas: REGRAS_RECOMPENSA.aula.moedas,
    });

    const modulo = await verificarModuloConcluido(tx, usuario.id, aula.idModulo);

    return {
      novo: true,
      xp: recompensa.xp + modulo.xp,
      moedas: recompensa.moedas + modulo.moedas,
      moduloConcluido: modulo.concluido,
    };
  });
}
