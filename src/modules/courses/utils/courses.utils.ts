import type {
  CriarCursoInput,
  AtualizarCursoInput,
} from "../types/courses.types.js";

export function cursoEstaCompleto(
  dados: {
    nome: string;
    categoria: CriarCursoInput["categoria"];
    descricao?: string | null;
    idCapa?: string | null;
    iconeCapa?: string | null;
  },
): boolean {
  return Boolean(
    dados.nome.trim() &&
    dados.categoria &&
    dados.descricao?.trim() &&
    (dados.idCapa || dados.iconeCapa),
  );
}

export function obterStatusInicialCurso(
  dados: CriarCursoInput,
  idCapa?: string | null,
): "RASCUNHO" | "INATIVO" {
  return cursoEstaCompleto({
    ...dados,
    idCapa,
    iconeCapa: idCapa ? null : dados.capa,
  })
    ? "INATIVO"
    : "RASCUNHO";
}

export function mesclarDadosCurso(
  atual: {
    nome: string;
    categoria: CriarCursoInput["categoria"];
    descricao: string | null;
    idCapa: string | null;
    iconeCapa: string | null;
  },
  alteracoes: AtualizarCursoInput,
  idCapaNovo?: string | null,
) {
  const enviouNovaCapa =
    alteracoes.capa !== undefined ||
    idCapaNovo !== undefined;

  return {
    nome: alteracoes.nome ?? atual.nome,
    categoria: alteracoes.categoria ?? atual.categoria,

    descricao:
      alteracoes.descricao !== undefined
        ? alteracoes.descricao
        : atual.descricao,

    idCapa: enviouNovaCapa
      ? idCapaNovo ?? null
      : atual.idCapa,

    iconeCapa: enviouNovaCapa
      ? (idCapaNovo ? null : alteracoes.capa || null)
      : atual.iconeCapa,
  };
}