export interface CriarSessaoInput {
  idCurso: string;
  titulo: string;
  subtitulo?: string | null;
  descricao?: string | null;
}

export interface AtualizarSessaoInput {
  titulo?: string;
  subtitulo?: string | null;
  descricao?: string | null;
}