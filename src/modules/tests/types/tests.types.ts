export interface CriarAtividadeInput {
  idModulo: string;
  titulo: string;
  tempoMinutos?: number;
  idsQuestoes: string[];
}
