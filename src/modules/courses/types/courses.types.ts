import type {
  CategoriaCurso,
  StatusCurso,
} from "../../../generated/prisma/client.js";

export type IconeCapaCurso =
  | "livro"
  | "matematica"
  | "biologia"
  | "ciencias"
  | "historia"
  | "geografia"
  | "idiomas"
  | "artes";

export interface CriarCursoInput {
  nome: string;
  categoria: CategoriaCurso;
  cargaHoraria?: number | null;
  descricao?: string;
  vagas?: number | null;
  preco?: number | null;
  cor?: string | null;
  capa?: IconeCapaCurso;
}

export interface AtualizarCursoInput {
  nome?: string;
  categoria?: CategoriaCurso;
  cargaHoraria?: number | null;
  descricao?: string | null;
  vagas?: number | null;
  preco?: number | null;
  cor?: string | null;
  capa?: IconeCapaCurso | "" | null;
  status?: StatusCurso;
}

export interface FiltrosCursosInput {
  pagina: number;
  nome?: string;
  categoria?: CategoriaCurso;
  status?: StatusCurso;
}