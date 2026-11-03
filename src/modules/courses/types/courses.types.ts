import type {
  CategoriaCurso,
  StatusCurso,
} from "../../../generated/prisma/client.js";

export interface CriarCursoInput {
  nome: string;
  categoria: CategoriaCurso;
  descricao?: string;
  vagas?: number | null;
  preco?: number | null;
  cor?: string | null;
  idCapa?: string | null;
}

export interface AtualizarCursoInput {
  nome?: string;
  categoria?: CategoriaCurso;
  descricao?: string | null;
  vagas?: number | null;
  preco?: number | null;
  cor?: string | null;
  idCapa?: string | null;
  status?: StatusCurso;
}

export interface FiltrosCursosInput {
  pagina: number;
  nome?: string;
  categoria?: CategoriaCurso;
  status?: StatusCurso;
}