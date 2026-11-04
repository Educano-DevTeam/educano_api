import { prisma } from "../../../config/prisma.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import { dadosInvalidos, naoEncontrado, semPermissao } from "../../../shared/erros.js";
import { ehAdmin, type UsuarioAutenticado } from "../../../shared/usuario.js";
import type {
  ConteudoInput,
  SessaoEstruturaInput,
} from "../schemas/estrutura.schema.js";
import { buscarCurso, exigirGestao, podeGerenciarCurso } from "./acesso.service.js";

type Transacao = Prisma.TransactionClient;

const ordemCriacao = [{ criadoEm: "asc" as const }, { id: "asc" as const }];

// Duração padrão de uma atividade: 2,5 minutos por questão (mínimo 5).
export function tempoAtividadePadrao(totalQuestoes: number): number {
  return Math.max(5, Math.round(totalQuestoes * 2.5));
}

/**
 * Curso com sessões, módulos, aulas e atividades, e o progresso do usuário.
 */
export async function consultarEstrutura(usuario: UsuarioAutenticado, idCurso: string) {
  const curso = await prisma.curso.findUnique({
    where: { id: idCurso },
    select: {
      id: true,
      nome: true,
      descricao: true,
      categoria: true,
      status: true,
      vagas: true,
      preco: true,
      cor: true,
      idCapa: true,
      iconeCapa: true,
      criadoEm: true,
      idResponsavel: true,
      responsavel: { select: { id: true, nome: true } },
      _count: { select: { inscricoes: true } },
      inscricoes: {
        where: { idUsuario: usuario.id },
        select: { turma: true, criadoEm: true },
      },
      sessoes: {
        orderBy: ordemCriacao,
        select: {
          id: true,
          titulo: true,
          subtitulo: true,
          descricao: true,
          modulos: {
            orderBy: ordemCriacao,
            select: {
              id: true,
              titulo: true,
              descricao: true,
              licaoTitulo: true,
              xp: true,
              aulas: {
                orderBy: ordemCriacao,
                select: {
                  id: true,
                  titulo: true,
                  descricao: true,
                  tipo: true,
                  duracaoMinutos: true,
                  quantidadePaginas: true,
                  criadoEm: true,
                  arquivo: {
                    select: {
                      id: true,
                      nomeOriginal: true,
                      contentType: true,
                      tamanhoBytes: true,
                    },
                  },
                },
              },
              testes: {
                where: { tipo: "ATIVIDADE" },
                orderBy: ordemCriacao,
                select: {
                  id: true,
                  tema: true,
                  tempoMinutos: true,
                  criadoEm: true,
                  questoes: { orderBy: { ordem: "asc" }, select: { idQuestao: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!curso) throw naoEncontrado("Curso não encontrado.");

  const podeEditar = podeGerenciarCurso(usuario, curso);
  const inscricao = curso.inscricoes[0] ?? null;

  // Cursos não ativos ficam restritos ao responsável, ao administrador
  // e a quem já estava inscrito.
  if (curso.status !== "ATIVO" && !podeEditar && !inscricao) {
    throw naoEncontrado("Curso não encontrado.");
  }

  const modulos = curso.sessoes.flatMap((s) => s.modulos);
  const idsAulas = modulos.flatMap((m) => m.aulas.map((a) => a.id));
  const idsTestes = modulos.flatMap((m) => m.testes.map((t) => t.id));

  const [aulasConcluidas, testesConcluidos] = await Promise.all([
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

  const concluidos = new Set([
    ...aulasConcluidas.map((p) => p.idAula),
    ...testesConcluidos.map((t) => t.idTeste),
  ]);

  let proximo: { idSessao: string; idModulo: string; idConteudo: string; titulo: string } | null = null;
  let cargaHorariaMinutos = 0;

  const sessoes = curso.sessoes.map((sessao) => ({
    id: sessao.id,
    titulo: sessao.titulo,
    subtitulo: sessao.subtitulo ?? "",
    descricao: sessao.descricao ?? "",
    modulos: sessao.modulos.map((modulo) => {
      const conteudos = [
        ...modulo.aulas.map((aula) => {
          cargaHorariaMinutos += aula.duracaoMinutos ?? 0;
          return {
            id: aula.id,
            tipo: aula.tipo as string,
            titulo: aula.titulo,
            descricao: aula.descricao ?? "",
            duracaoMinutos: aula.duracaoMinutos,
            quantidadePaginas: aula.quantidadePaginas,
            arquivo: aula.arquivo
              ? { ...aula.arquivo, tamanhoBytes: aula.arquivo.tamanhoBytes.toString() }
              : null,
            criadoEm: aula.criadoEm,
          };
        }),
        ...modulo.testes.map((teste) => {
          cargaHorariaMinutos += teste.tempoMinutos;
          return {
            id: teste.id,
            tipo: "ATIVIDADE",
            titulo: teste.tema ?? "Atividade",
            descricao: "",
            tempoMinutos: teste.tempoMinutos,
            totalQuestoes: teste.questoes.length,
            // Os ids das questões só interessam a quem edita a atividade.
            ...(podeEditar && { idsQuestoes: teste.questoes.map((q) => q.idQuestao) }),
            criadoEm: teste.criadoEm,
          };
        }),
      ]
        .sort((a, b) => a.criadoEm.getTime() - b.criadoEm.getTime())
        .map(({ criadoEm: _criadoEm, ...conteudo }) => {
          const concluido = concluidos.has(conteudo.id);

          if (!concluido && !proximo) {
            proximo = {
              idSessao: sessao.id,
              idModulo: modulo.id,
              idConteudo: conteudo.id,
              titulo: conteudo.titulo,
            };
          }

          return { ...conteudo, concluido };
        });

      const feitos = conteudos.filter((c) => c.concluido).length;

      return {
        id: modulo.id,
        titulo: modulo.titulo,
        descricao: modulo.descricao ?? "",
        licaoTitulo: modulo.licaoTitulo ?? "",
        xp: modulo.xp,
        conteudos,
        concluido: conteudos.length > 0 && feitos === conteudos.length,
        progresso: conteudos.length === 0 ? 0 : feitos / conteudos.length,
      };
    }),
  }));

  const total = idsAulas.length + idsTestes.length;
  const feitos = [...idsAulas, ...idsTestes].filter((id) => concluidos.has(id)).length;

  return {
    curso: {
      id: curso.id,
      nome: curso.nome,
      descricao: curso.descricao ?? "",
      categoria: curso.categoria,
      status: curso.status,
      vagas: curso.vagas,
      preco: curso.preco,
      cor: curso.cor,
      idCapa: curso.idCapa,
      iconeCapa: curso.iconeCapa,
      criadoEm: curso.criadoEm,
      responsavel: curso.responsavel,
      inscritos: curso._count.inscricoes,
      inscrito: Boolean(inscricao),
      inscricao,
      podeEditar,
      cargaHorariaMinutos,
      progresso: {
        totalConteudos: total,
        concluidos: feitos,
        percentual: total === 0 ? 0 : feitos / total,
        proximo,
      },
    },
    sessoes,
  };
}

// ---------------------------------------------------------------------------
// Sincronização da estrutura (editor do dashboard)
// ---------------------------------------------------------------------------

const TIPOS_ARQUIVO: Record<string, string> = {
  VIDEO: "VIDEO",
  AUDIO: "AUDIO",
  PDF: "PDF",
  DOCUMENTO: "DOCUMENTO",
};

export async function validarArquivoAula(
  tx: Transacao,
  usuario: UsuarioAutenticado,
  conteudo: { titulo: string; tipo: string; idArquivo?: string },
  idAulaAtual?: string,
) {
  if (!conteudo.idArquivo) return;

  const arquivo = await tx.arquivo.findUnique({
    where: { id: conteudo.idArquivo },
    select: {
      tipo: true,
      finalidade: true,
      status: true,
      idOrigem: true,
      aula: { select: { id: true } },
    },
  });

  if (!arquivo || arquivo.status !== "CONCLUIDO") {
    throw dadosInvalidos(`O arquivo da aula "${conteudo.titulo}" não foi encontrado.`);
  }

  if (!["MATERIAL_AULA", "MATERIAL_CURSO"].includes(arquivo.finalidade)) {
    throw dadosInvalidos(`O arquivo de "${conteudo.titulo}" não foi enviado como material de aula.`);
  }

  if (TIPOS_ARQUIVO[conteudo.tipo] !== arquivo.tipo) {
    throw dadosInvalidos(
      `O arquivo enviado para "${conteudo.titulo}" não é do tipo ${conteudo.tipo}.`,
    );
  }

  if (arquivo.aula && arquivo.aula.id !== idAulaAtual) {
    throw dadosInvalidos(`O arquivo de "${conteudo.titulo}" já está vinculado a outra aula.`);
  }

  if (!ehAdmin(usuario) && arquivo.idOrigem !== usuario.id) {
    throw semPermissao("Você só pode vincular arquivos enviados por você.");
  }
}

export async function validarQuestoes(tx: Transacao, idsQuestoes: string[]) {
  if (idsQuestoes.length === 0) return;

  const encontradas = await tx.questao.count({ where: { id: { in: idsQuestoes } } });

  if (encontradas !== new Set(idsQuestoes).size) {
    throw dadosInvalidos("Uma ou mais questões da atividade não existem.");
  }
}

export async function substituirQuestoesTeste(
  tx: Transacao,
  idTeste: string,
  idsQuestoes: string[],
) {
  const unicos = [...new Set(idsQuestoes)];

  await tx.testeQuestao.deleteMany({ where: { idTeste } });

  if (unicos.length > 0) {
    await tx.testeQuestao.createMany({
      data: unicos.map((idQuestao, ordem) => ({ idTeste, idQuestao, ordem })),
    });
  }

  await tx.teste.update({
    where: { id: idTeste },
    data: { quantidadeQuestoes: unicos.length },
  });
}

/** Cria uma aula ou atividade no módulo. */
export async function criarConteudo(
  tx: Transacao,
  usuario: UsuarioAutenticado,
  idModulo: string,
  conteudo: ConteudoInput,
  criadoEm?: Date,
) {
  if (conteudo.tipo === "ATIVIDADE") {
    const idsQuestoes = conteudo.idsQuestoes ?? [];
    await validarQuestoes(tx, idsQuestoes);

    const teste = await tx.teste.create({
      data: {
        idModulo,
        idResponsavel: usuario.id,
        tipo: "ATIVIDADE",
        tema: conteudo.titulo,
        tempoMinutos: conteudo.tempoMinutos ?? tempoAtividadePadrao(idsQuestoes.length),
        ...(criadoEm && { criadoEm }),
      },
      select: { id: true },
    });

    await substituirQuestoesTeste(tx, teste.id, idsQuestoes);
    return { id: teste.id, tipo: "ATIVIDADE" };
  }

  if (!conteudo.idArquivo) {
    throw dadosInvalidos(`Envie o arquivo da aula "${conteudo.titulo}".`);
  }

  await validarArquivoAula(tx, usuario, conteudo);

  const aula = await tx.aula.create({
    data: {
      idModulo,
      idResponsavel: usuario.id,
      titulo: conteudo.titulo,
      descricao: conteudo.descricao || null,
      tipo: conteudo.tipo,
      idArquivo: conteudo.idArquivo,
      duracaoMinutos: conteudo.duracaoMinutos ?? null,
      quantidadePaginas: conteudo.quantidadePaginas ?? null,
      ...(criadoEm && { criadoEm }),
    },
    select: { id: true },
  });

  return { id: aula.id, tipo: conteudo.tipo };
}

async function atualizarConteudo(
  tx: Transacao,
  usuario: UsuarioAutenticado,
  idModulo: string,
  conteudo: ConteudoInput & { id: string },
  ids: { aulas: Set<string>; testes: Set<string> },
) {
  if (conteudo.tipo === "ATIVIDADE") {
    if (!ids.testes.has(conteudo.id)) {
      throw dadosInvalidos("Uma das atividades informadas não pertence ao curso.");
    }

    await tx.teste.update({
      where: { id: conteudo.id },
      data: {
        idModulo,
        tema: conteudo.titulo,
        ...(conteudo.tempoMinutos && { tempoMinutos: conteudo.tempoMinutos }),
      },
    });

    if (conteudo.idsQuestoes) {
      await validarQuestoes(tx, conteudo.idsQuestoes);
      await substituirQuestoesTeste(tx, conteudo.id, conteudo.idsQuestoes);
    }
    return;
  }

  if (!ids.aulas.has(conteudo.id)) {
    throw dadosInvalidos("Uma das aulas informadas não pertence ao curso.");
  }

  await validarArquivoAula(tx, usuario, conteudo, conteudo.id);

  await tx.aula.update({
    where: { id: conteudo.id },
    data: {
      idModulo,
      titulo: conteudo.titulo,
      descricao: conteudo.descricao || null,
      tipo: conteudo.tipo,
      duracaoMinutos: conteudo.duracaoMinutos ?? null,
      quantidadePaginas: conteudo.quantidadePaginas ?? null,
      // Sem novo arquivo, mantém o atual.
      ...(conteudo.idArquivo && { idArquivo: conteudo.idArquivo }),
    },
  });
}

/**
 * Substitui a estrutura do curso pela árvore recebida.
 * Itens com id são atualizados, itens sem id são criados e os que não
 * aparecem mais são removidos.
 */
export async function salvarEstrutura(
  usuario: UsuarioAutenticado,
  idCurso: string,
  sessoes: SessaoEstruturaInput[],
) {
  const curso = await buscarCurso(idCurso);
  exigirGestao(usuario, curso);

  await prisma.$transaction(async (tx) => {
    const atuais = await tx.sessao.findMany({
      where: { idCurso },
      select: {
        id: true,
        modulos: {
          select: {
            id: true,
            aulas: { select: { id: true } },
            testes: { select: { id: true } },
          },
        },
      },
    });

    const ids = {
      sessoes: new Set(atuais.map((s) => s.id)),
      modulos: new Set(atuais.flatMap((s) => s.modulos.map((m) => m.id))),
      aulas: new Set(atuais.flatMap((s) => s.modulos.flatMap((m) => m.aulas.map((a) => a.id)))),
      testes: new Set(atuais.flatMap((s) => s.modulos.flatMap((m) => m.testes.map((t) => t.id)))),
    };

    const recebidos = {
      sessoes: new Set(sessoes.flatMap((s) => (s.id ? [s.id] : []))),
      modulos: new Set(sessoes.flatMap((s) => s.modulos.flatMap((m) => (m.id ? [m.id] : [])))),
      conteudos: new Set(
        sessoes.flatMap((s) =>
          s.modulos.flatMap((m) => m.conteudos.flatMap((c) => (c.id ? [c.id] : []))),
        ),
      ),
    };

    // Remove primeiro o que saiu da estrutura.
    await tx.aula.deleteMany({
      where: { id: { in: [...ids.aulas].filter((id) => !recebidos.conteudos.has(id)) } },
    });
    await tx.teste.deleteMany({
      where: { id: { in: [...ids.testes].filter((id) => !recebidos.conteudos.has(id)) } },
    });
    await tx.modulo.deleteMany({
      where: { id: { in: [...ids.modulos].filter((id) => !recebidos.modulos.has(id)) } },
    });
    await tx.sessao.deleteMany({
      where: { id: { in: [...ids.sessoes].filter((id) => !recebidos.sessoes.has(id)) } },
    });

    // Itens novos recebem horários crescentes para manter a ordem do editor.
    let sequencia = Date.now();
    const proximaData = () => new Date(sequencia++);

    for (const sessao of sessoes) {
      const dadosSessao = {
        titulo: sessao.titulo,
        subtitulo: sessao.subtitulo || null,
        descricao: sessao.descricao || null,
      };

      let idSessao: string;

      if (sessao.id) {
        if (!ids.sessoes.has(sessao.id)) {
          throw dadosInvalidos("Uma das sessões informadas não pertence ao curso.");
        }
        idSessao = sessao.id;
        await tx.sessao.update({ where: { id: idSessao }, data: dadosSessao });
      } else {
        const criada = await tx.sessao.create({
          data: { ...dadosSessao, idCurso, idResponsavel: usuario.id, criadoEm: proximaData() },
          select: { id: true },
        });
        idSessao = criada.id;
      }

      for (const modulo of sessao.modulos) {
        const dadosModulo = {
          titulo: modulo.titulo,
          descricao: modulo.descricao || null,
          licaoTitulo: modulo.licaoTitulo || null,
          xp: modulo.xp,
        };

        let idModulo: string;

        if (modulo.id) {
          if (!ids.modulos.has(modulo.id)) {
            throw dadosInvalidos("Um dos módulos informados não pertence ao curso.");
          }
          idModulo = modulo.id;
          await tx.modulo.update({ where: { id: idModulo }, data: { ...dadosModulo, idSessao } });
        } else {
          const criado = await tx.modulo.create({
            data: { ...dadosModulo, idSessao, idResponsavel: usuario.id, criadoEm: proximaData() },
            select: { id: true },
          });
          idModulo = criado.id;
        }

        for (const conteudo of modulo.conteudos) {
          if (conteudo.id) {
            await atualizarConteudo(tx, usuario, idModulo, { ...conteudo, id: conteudo.id }, ids);
          } else {
            await criarConteudo(tx, usuario, idModulo, conteudo, proximaData());
          }
        }
      }
    }
  });

  return consultarEstrutura(usuario, idCurso);
}
