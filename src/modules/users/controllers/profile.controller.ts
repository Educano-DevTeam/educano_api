
import type { Request, Response } from "express";
import { z } from "zod";
import { editarPerfilSchema } from "../schemas/profile.schema.js";
import {
  consultarPerfil,
  editarPerfil,
  excluirPerfil,
  ProfileServiceError,
} from "../services/profile.service.js";

const paramsSchema = z.object({
  identifier: z.string().trim().min(1).max(255),
});

function responderErro(res: Response, error: unknown) {
  if (error instanceof ProfileServiceError) {
    const status =
      error.code === "PERFIL_NAO_ENCONTRADO" ? 404 : 400;

    return res.status(status).json({
      message: error.message,
    });
  }

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

  console.error("Erro no módulo de perfil:", error);

  return res.status(500).json({
    message: "Não foi possível concluir a solicitação.",
  });
}

export async function consultarMeuPerfil(
  req: Request,
  res: Response,
) {
  try {
    const perfil = await consultarPerfil(
      req.usuarioAutenticado!.id,
    );

    return res.status(200).json({ perfil });
  } catch (error) {
    return responderErro(res, error);
  }
}


export async function consultarPerfilPorIdentificador(
  req: Request,
  res: Response,
) {
  const params = paramsSchema.safeParse(req.params);

  if (!params.success) {
    return res.status(400).json({
      message: "Identificador inválido.",
    });
  }

  try {
    const autenticado = req.usuarioAutenticado!;
    const identificador = params.data.identifier;

    // Busca o usuário correspondente ao ID ou e-mail informado.
    const { consultarUsuario } = await import(
      "../services/users.service.js"
    );

    const usuario = await consultarUsuario(identificador);

    const ehProprioUsuario = autenticado.id === usuario.id;
    const ehAdmin = autenticado.tipo === "ADMIN";

    // Usuários autenticados podem consultar o próprio perfil.
    // Administradores também podem consultar qualquer perfil.
    if (ehProprioUsuario || ehAdmin) {
      const perfil = await consultarPerfil(usuario.id);

      return res.status(200).json({ perfil });
    }

    // Outros usuários só podem visualizar perfis públicos.
    const perfil = await consultarPerfil(usuario.id);

    if (perfil.tipoPerfil !== "PUBLICO") {
      return res.status(404).json({
        erro: "PERFIL_NAO_ENCONTRADO",
        mensagem: "Perfil não encontrado.",
      });
    }

    // Retorna apenas informações permitidas para a consulta pública.
    return res.status(200).json({
      dados: {
        idUsuario: usuario.id,
        nome: usuario.nome,
        tipo: usuario.tipo,
        tipoPerfil: perfil.tipoPerfil,
        xp: perfil.xp,
        moedas: perfil.moedas,
        nivel: perfil.nivel,
        cor: perfil.cor,
        urlFotoPerfil: perfil.urlFotoPerfil,
        urlFotoBackground: perfil.urlFotoBackground,
      },
    });
  } catch (error) {
    return responderErro(res, error);
  }
}


export async function atualizarMeuPerfil(
  req: Request,
  res: Response,
) {
  const body = editarPerfilSchema.safeParse(req.body);

  if (!body.success) {
    return res.status(400).json({
      message: "Dados inválidos para edição do perfil.",
      errors: body.error.issues,
    });
  }

  try {
    const perfil = await editarPerfil(
      req.usuarioAutenticado!.id,
      body.data,
    );

    return res.status(200).json({
      message: "Perfil atualizado com sucesso.",
      perfil,
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function atualizarPerfilPorIdentificador(
  req: Request,
  res: Response,
) {
  const params = paramsSchema.safeParse(req.params);
  const body = editarPerfilSchema.safeParse(req.body);

  if (!params.success || !body.success) {
    return res.status(400).json({
      message: "Dados inválidos para edição do perfil.",
      errors: [
        ...(!params.success ? params.error.issues : []),
        ...(!body.success ? body.error.issues : []),
      ],
    });
  }

  try {
    const perfil = await editarPerfil(
      params.data.identifier,
      body.data,
    );

    return res.status(200).json({
      message: "Perfil atualizado com sucesso.",
      perfil,
    });
  } catch (error) {
    return responderErro(res, error);
  }
}

export async function removerPerfil(
  req: Request,
  res: Response,
) {
  const params = paramsSchema.safeParse(req.params);

  if (!params.success) {
    return res.status(400).json({
      message: "Identificador inválido.",
    });
  }

  try {
    await excluirPerfil(params.data.identifier);

    return res.status(200).json({
      message: "Perfil excluído com sucesso. A conta do usuário foi mantida.",
    });
  } catch (error) {
    return responderErro(res, error);
  }
}
