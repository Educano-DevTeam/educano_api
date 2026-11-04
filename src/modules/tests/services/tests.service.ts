import { prisma } from "../../../config/prisma.js";
import { naoEncontrado } from "../../../shared/erros.js";
import type { UsuarioAutenticado } from "../../../shared/usuario.js";
import { cursoDoModulo, exigirGestao } from "../../courses/services/acesso.service.js";
import { criarConteudo } from "../../courses/services/estrutura.service.js";
import type { CriarAtividadeInput } from "../types/tests.types.js";

export async function criarAtividade(usuario: UsuarioAutenticado, dados: CriarAtividadeInput) {
  exigirGestao(usuario, await cursoDoModulo(dados.idModulo));

  const criado = await prisma.$transaction((tx) =>
    criarConteudo(tx, usuario, dados.idModulo, { ...dados, tipo: "ATIVIDADE" }),
  );

  return prisma.teste.findUniqueOrThrow({
    where: { id: criado.id },
    select: { id: true, tema: true, tempoMinutos: true, quantidadeQuestoes: true },
  });
}

export async function excluirAtividade(usuario: UsuarioAutenticado, id: string) {
  const teste = await prisma.teste.findUnique({
    where: { id },
    select: { idModulo: true, tipo: true },
  });

  if (!teste?.idModulo || teste.tipo !== "ATIVIDADE") {
    throw naoEncontrado("Atividade não encontrada.");
  }

  exigirGestao(usuario, await cursoDoModulo(teste.idModulo));
  await prisma.teste.delete({ where: { id } });
}
