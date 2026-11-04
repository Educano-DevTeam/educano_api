import type { TurmaInscricao } from "../../../generated/prisma/client.js";

export interface InscreverInput {
  idUsuario: string;
  idCurso: string;
  turma: TurmaInscricao;
}
