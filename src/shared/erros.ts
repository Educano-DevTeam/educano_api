import type { Response } from "express";
import type { ZodError } from "zod";

/**
 * Erro de regra de negócio usado pelos módulos novos.
 * O status HTTP acompanha o erro para evitar um mapa por controller.
 */
export class ErroServico extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ErroServico";
  }
}

export function naoEncontrado(mensagem: string): ErroServico {
  return new ErroServico(404, "NAO_ENCONTRADO", mensagem);
}

export function semPermissao(
  mensagem = "Você não tem permissão para executar esta ação.",
): ErroServico {
  return new ErroServico(403, "SEM_PERMISSAO", mensagem);
}

export function dadosInvalidos(mensagem: string): ErroServico {
  return new ErroServico(400, "DADOS_INVALIDOS", mensagem);
}

export function conflito(mensagem: string): ErroServico {
  return new ErroServico(409, "CONFLITO", mensagem);
}

export function responderValidacao(
  res: Response,
  mensagem: string,
  erro: ZodError,
) {
  return res.status(400).json({
    message: mensagem,
    errors: erro.issues,
  });
}

function codigoPrisma(error: unknown): string | null {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }

  return null;
}

export function responderErro(
  res: Response,
  error: unknown,
  contexto: string,
) {
  if (error instanceof ErroServico) {
    return res.status(error.status).json({
      code: error.code,
      message: error.message,
    });
  }

  const codigo = codigoPrisma(error);

  if (codigo === "P2002") {
    return res.status(409).json({
      code: "CONFLITO",
      message: "Já existe um registro com esses dados.",
    });
  }

  if (codigo === "P2025") {
    return res.status(404).json({
      code: "NAO_ENCONTRADO",
      message: "Registro não encontrado.",
    });
  }

  if (codigo && ["P1001", "P1002", "P2024"].includes(codigo)) {
    console.error("Banco de dados indisponível:", error);

    return res.status(503).json({
      message: "Banco de dados temporariamente indisponível.",
    });
  }

  console.error(`Erro no módulo de ${contexto}:`, error);

  return res.status(500).json({
    message: "Não foi possível concluir a solicitação.",
  });
}
