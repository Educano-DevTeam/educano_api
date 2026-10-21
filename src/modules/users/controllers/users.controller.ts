
import type { Request, Response } from "express";
import {
  identificadorParamsSchema,
  listarUsuariosQuerySchema,
  editarUsuarioSchema,
} from "../schemas/users.schema.js";
import {
  UsersServiceError,
  consultarUsuario,
  listarUsuarios,
  editarUsuario,
  excluirUsuario,
} from "../services/users.service.js";

function responderErro(res: Response, error: unknown) {
  if (error instanceof UsersServiceError) {
    const status: Record<string, number> = {
      USUARIO_NAO_ENCONTRADO: 404,
      EMAIL_JA_CADASTRADO: 409,
      DADOS_INVALIDOS: 400,
    };

    return res.status(status[error.code] ?? 400).json({
      message: error.message,
    });
  }

  // Erros conhecidos de indisponibilidade do PostgreSQL/Prisma.
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    ["P1001", "P1002", "P2024"].includes(error.code)
  ) {
    console.error("Banco de dados indisponível:", error);

    return res.status(503).json({
      message: "Banco de dados temporariamente indisponível.",
    });
  }

  console.error("Erro no módulo de usuários:", error);

  return res.status(500).json({
    message: "Não foi possível concluir a solicitação.",
  });
}

export async function consultarMeuUsuario(
  req: Request,
  res: Response,
) {
  try {
    const id = req.usuarioAutenticado!.id;
    const usuario = await consultarUsuario(id);

    return res.status(200).json({ usuario });
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function consultarUsuarioPorIdentificador(
  req: Request,
  res: Response,
): Promise<Response> {
  try {
    const { identifier } = identificadorParamsSchema.parse(req.params);

    // O middleware autenticar garante que o usuário esteja autenticado.
    const usuario = await consultarUsuario(identifier);

    // Somente o próprio usuário ou um administrador pode
    // consultar os dados completos da conta.
    const ehProprioUsuario =
      req.usuarioAutenticado?.id === usuario.id;

    const ehAdmin =
      req.usuarioAutenticado?.tipo === "ADMIN";

    if (ehProprioUsuario || ehAdmin) {
      return res.status(200).json({ dados: usuario });
    }

    // Para outros usuários, retornamos apenas dados públicos.
    return res.status(200).json({
      dados: {
        id: usuario.id,
        nome: usuario.nome,
        tipo: usuario.tipo,
      },
    });
  } catch (erro) {
    return responderErro(res, erro);
  }
}

export async function listar(req: Request, res: Response) {
  const validacao = listarUsuariosQuerySchema.safeParse(req.query);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Número de página inválido.",
      errors: validacao.error.issues,
    });
  }

  try {
    const resultado = await listarUsuarios(validacao.data.page);

    return res.status(200).json(resultado);
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function atualizarUsuario(
  req: Request,
  res: Response,
) {
  const params = identificadorParamsSchema.safeParse(req.params);
  const body = editarUsuarioSchema.safeParse(req.body);

  if (!params.success || !body.success) {
    return res.status(400).json({
      message: "Dados inválidos para edição.",
      errors: [
        ...(!params.success ? params.error.issues : []),
        ...(!body.success ? body.error.issues : []),
      ],
    });
  }

  try {
    const usuario = await editarUsuario(
      params.data.identifier,
      body.data,
    );

    return res.status(200).json({
      message: "Usuário atualizado com sucesso.",
      usuario,
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function removerUsuario(
  req: Request,
  res: Response,
) {
  const validacao = identificadorParamsSchema.safeParse(req.params);

  if (!validacao.success) {
    return res.status(400).json({
      message: "Identificador inválido.",
    });
  }

  try {
    await excluirUsuario(validacao.data.identifier);

    return res.status(200).json({
      message: "Usuário excluído com sucesso.",
    });
  } catch (error) {
    return responderErro(res, error);
  }
}
