import { z } from "zod";

export const paginaSchema = z.coerce.number().int().min(1).default(1);

export function montarPaginacao(
  pagina: number,
  porPagina: number,
  total: number,
) {
  const totalPaginas = Math.ceil(total / porPagina);

  return {
    pagina,
    porPagina,
    total,
    totalPaginas,
    temMais: pagina < totalPaginas,
    proximaPagina: pagina < totalPaginas ? pagina + 1 : null,
  };
}
