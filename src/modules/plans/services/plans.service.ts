import { prisma } from "../../../config/prisma.js";
import { naoEncontrado } from "../../../shared/erros.js";
import type { UsuarioAutenticado } from "../../../shared/usuario.js";

const selecaoPlano = {
  id: true,
  nome: true,
  precoCentavos: true,
  cor: true,
  icone: true,
  destaque: true,
  beneficios: true,
  indisponiveis: true,
  limiteSimuladosMes: true,
  ordem: true,
} as const;

async function planoAtual(idUsuario: string) {
  const perfil = await prisma.perfil.findUnique({
    where: { idUsuario },
    select: { planoContaId: true },
  });

  if (perfil?.planoContaId) return perfil.planoContaId;

  // Contas sem plano definido usam o plano gratuito (o de menor ordem).
  const gratuito = await prisma.planoConta.findFirst({
    orderBy: { ordem: "asc" },
    select: { id: true },
  });

  return gratuito?.id ?? null;
}

export async function listarPlanos(usuario: UsuarioAutenticado) {
  const [planos, atual] = await Promise.all([
    prisma.planoConta.findMany({ orderBy: { ordem: "asc" }, select: selecaoPlano }),
    planoAtual(usuario.id),
  ]);

  return {
    idPlanoAtual: atual,
    dados: planos.map((plano) => ({ ...plano, atual: plano.id === atual })),
  };
}

/**
 * Troca o plano do usuário. O pagamento ainda não é integrado: a alteração
 * é aplicada na hora e libera os benefícios do novo plano.
 */
export async function alterarPlano(usuario: UsuarioAutenticado, idPlano: string) {
  const plano = await prisma.planoConta.findUnique({
    where: { id: idPlano },
    select: selecaoPlano,
  });

  if (!plano) throw naoEncontrado("Plano não encontrado.");

  await prisma.perfil.upsert({
    where: { idUsuario: usuario.id },
    create: { idUsuario: usuario.id, planoContaId: plano.id },
    update: { planoContaId: plano.id },
  });

  return { ...plano, atual: true };
}
