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
  },
): boolean {
  return Boolean(
    dados.nome.trim() &&
    dados.categoria &&
    dados.descricao?.trim() &&
    dados.idCapa,
  );
}

export function obterStatusInicialCurso(
  dados: CriarCursoInput,
): "RASCUNHO" | "INATIVO" {
  return cursoEstaCompleto(dados)
    ? "INATIVO"
    : "RASCUNHO";
}

export function mesclarDadosCurso(
  atual: {
    nome: string;
    categoria: CriarCursoInput["categoria"];
    descricao: string | null;
    idCapa: string | null;
  },
  alteracoes: AtualizarCursoInput,
) {
  return {
    nome: alteracoes.nome ?? atual.nome,
    categoria: alteracoes.categoria ?? atual.categoria,
    descricao:
      alteracoes.descricao !== undefined
        ? alteracoes.descricao
        : atual.descricao,
    idCapa:
      alteracoes.idCapa !== undefined
        ? alteracoes.idCapa
        : atual.idCapa,
  };
}