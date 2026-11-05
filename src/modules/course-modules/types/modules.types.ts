export interface CriarModuloInput {
  idSessao: string;
  titulo: string;
  descricao?: string | null;
}

export interface AtualizarModuloInput {
  titulo?: string;
  descricao?: string | null;
}