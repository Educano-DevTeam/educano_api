import { prisma } from "../../../config/prisma.js";
import { naoEncontrado } from "../../../shared/erros.js";
import type { UsuarioAutenticado } from "../../../shared/usuario.js";
import type { SalvarFlashcardInput } from "../schemas/flashcards.schema.js";

const selecaoFlashcard = {
  id: true,
  titulo: true,
  pergunta: true,
  resposta: true,
  repeticoesMensais: true,
  ultimaRevisaoEm: true,
  proximaRevisaoEm: true,
  criadoEm: true,
} as const;

// N revisões por mês => próxima revisão em aproximadamente 30/N dias.
function proximaRevisao(repeticoesMensais: number, base: Date): Date {
  const dias = 30 / Math.min(Math.max(repeticoesMensais, 1), 30);
  return new Date(base.getTime() + Math.round(dias * 24 * 60 * 60 * 1000));
}

/** Flashcards são privados: só o dono consegue ler ou alterar. */
async function exigirDono(usuario: UsuarioAutenticado, id: string) {
  const flashcard = await prisma.flashcard.findFirst({
    where: { id, idUsuario: usuario.id },
    select: { id: true, repeticoesMensais: true },
  });

  if (!flashcard) throw naoEncontrado("Flashcard não encontrado.");

  return flashcard;
}

export function listarFlashcards(usuario: UsuarioAutenticado) {
  return prisma.flashcard.findMany({
    where: { idUsuario: usuario.id },
    orderBy: [{ proximaRevisaoEm: { sort: "asc", nulls: "first" } }, { criadoEm: "desc" }],
    select: selecaoFlashcard,
  });
}

export function criarFlashcard(usuario: UsuarioAutenticado, dados: SalvarFlashcardInput) {
  return prisma.flashcard.create({
    data: { ...dados, idUsuario: usuario.id },
    select: selecaoFlashcard,
  });
}

export async function atualizarFlashcard(
  usuario: UsuarioAutenticado,
  id: string,
  dados: SalvarFlashcardInput,
) {
  await exigirDono(usuario, id);

  return prisma.flashcard.update({
    where: { id },
    data: dados,
    select: selecaoFlashcard,
  });
}

export async function excluirFlashcard(usuario: UsuarioAutenticado, id: string) {
  await exigirDono(usuario, id);
  await prisma.flashcard.delete({ where: { id } });
}

export async function revisarFlashcard(usuario: UsuarioAutenticado, id: string) {
  const flashcard = await exigirDono(usuario, id);
  const agora = new Date();

  return prisma.flashcard.update({
    where: { id },
    data: {
      ultimaRevisaoEm: agora,
      proximaRevisaoEm: proximaRevisao(flashcard.repeticoesMensais, agora),
    },
    select: selecaoFlashcard,
  });
}
