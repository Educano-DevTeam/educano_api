import type { TipoMaterial } from "../../../generated/prisma/client.js";

export interface CriarAulaInput {
    idModulo: string;
    titulo: string;
    descricao?: string;
    tipo: TipoMaterial;
    quantidadePaginas?: number;
    duracaoMinutos?: number;
}

export interface AtualizarAulaInput {
    titulo?: string;
    descricao?: string | null;
}