
import type { RequestHandler } from "express";
import { unlink } from "node:fs/promises";

import { prisma } from "../../../config/prisma.js";

import {
  FinalidadeArquivo,
  TipoArquivo,
} from "../../../generated/prisma/client.js";

import {
  enviarArquivo,
  consultarArquivo,
  excluirArquivo,
} from "../services/files.service.js";

interface ParametrosArquivo {
  id: string;
}

// Verifica se um valor pertence a um enum do Prisma.
function pertenceAoEnum<T extends Record<string, string>>(
  enumeracao: T,
  valor: unknown,
): valor is T[keyof T] {
  return (
    typeof valor === "string" &&
    Object.values(enumeracao).includes(valor)
  );
}

// Remove arquivo temporário, caso ainda exista.
async function removerTemporario(caminho?: string) {
  if (caminho) {
    await unlink(caminho).catch(() => undefined);
  }
}

// POST /api/files
// Envia um arquivo para o Cloudflare R2.
export const enviarArquivoController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const arquivo = req.file;

    if (!arquivo) {
      return res.status(400).json({
        mensagem: "Nenhum arquivo foi enviado.",
      });
    }

    const { tipo, finalidade } = req.body;

    if (!pertenceAoEnum(TipoArquivo, tipo)) {
      await removerTemporario(arquivo.path);

      return res.status(400).json({
        mensagem: "Tipo de arquivo inválido.",
        tiposPermitidos: Object.values(TipoArquivo),
      });
    }

    if (!pertenceAoEnum(FinalidadeArquivo, finalidade)) {
      await removerTemporario(arquivo.path);

      return res.status(400).json({
        mensagem: "Finalidade do arquivo inválida.",
        finalidadesPermitidas: Object.values(FinalidadeArquivo),
      });
    }

    const resultado = await enviarArquivo({
      arquivo,
      idOrigem: req.usuarioAutenticado!.id,
      tipo,
      finalidade,
    });

    return res.status(201).json({
      mensagem: "Arquivo enviado com sucesso.",
      arquivo: resultado,
    });
  } catch (erro) {
    await removerTemporario(req.file?.path);
    next(erro);
  }
};

// GET /api/files
// Lista os arquivos aos quais o usuário tem acesso.
export const listarArquivosController: RequestHandler = async (
  req,
  res,
  next,
) => {
  try {
    const pagina = Math.max(
      1,
      Number.parseInt(String(req.query.pagina ?? "1"), 10) || 1,
    );

    const limite = Math.min(
      50,
      Math.max(
        1,
        Number.parseInt(String(req.query.limite ?? "20"), 10) || 20,
      ),
    );

    const { tipo, finalidade } = req.query;

    if (
      tipo !== undefined &&
      !pertenceAoEnum(TipoArquivo, tipo)
    ) {
      return res.status(400).json({
        mensagem: "Filtro de tipo inválido.",
      });
    }

    if (
      finalidade !== undefined &&
      !pertenceAoEnum(FinalidadeArquivo, finalidade)
    ) {
      return res.status(400).json({
        mensagem: "Filtro de finalidade inválido.",
      });
    }

    const usuario = req.usuarioAutenticado!;

    const where = {
      ...(usuario.tipo === "ADMIN"
        ? {}
        : { idOrigem: usuario.id }),

      status: "CONCLUIDO" as const,

      ...(tipo ? { tipo } : {}),
      ...(finalidade ? { finalidade } : {}),
    };

    const [arquivos, total] = await prisma.$transaction([
      prisma.arquivo.findMany({
        where,
        orderBy: {
          criadoEm: "desc",
        },
        skip: (pagina - 1) * limite,
        take: limite,
      }),

      prisma.arquivo.count({
        where,
      }),
    ]);

    // Gera URLs temporárias para os arquivos da página.
    const arquivosComUrl = await Promise.all(
      arquivos.map(async (arquivo) => {
        return consultarArquivo(arquivo.id);
      }),
    );

    return res.status(200).json({
      mensagem: "Arquivos consultados com sucesso.",
      dados: arquivosComUrl.filter(Boolean),
      paginacao: {
        pagina,
        limite,
        total,
        totalPaginas: Math.ceil(total / limite),
      },
    });
  } catch (erro) {
    next(erro);
  }
};

// GET /api/files/:id
// Consulta um arquivo específico.
export const consultarArquivoController: RequestHandler<ParametrosArquivo> = async (
  req,
  res,
  next,
) => {
  try {
    const { id } = req.params;
    const usuario = req.usuarioAutenticado!;

    const registro = await prisma.arquivo.findUnique({
      where: { id },
      select: {
        id: true,
        idOrigem: true,
      },
    });

    if (!registro) {
      return res.status(404).json({
        mensagem: "Arquivo não encontrado.",
      });
    }

    if (
      usuario.tipo !== "ADMIN" &&
      registro.idOrigem !== usuario.id
    ) {
      return res.status(403).json({
        mensagem: "Você não tem permissão para acessar este arquivo.",
      });
    }

    const arquivo = await consultarArquivo(id);

    if (!arquivo) {
      return res.status(404).json({
        mensagem: "Arquivo não encontrado ou indisponível.",
      });
    }

    return res.status(200).json({
      mensagem: "Arquivo consultado com sucesso.",
      arquivo,
    });
  } catch (erro) {
    next(erro);
  }
};

// DELETE /api/files/:id
// Exclui um arquivo do R2 e do banco.
export const excluirArquivoController: RequestHandler<ParametrosArquivo> = async (
  req,
  res,
  next,
) => {
  try {
    const { id } = req.params;
    const usuario = req.usuarioAutenticado!;

    const registro = await prisma.arquivo.findUnique({
      where: { id },
      select: {
        id: true,
        idOrigem: true,
      },
    });

    if (!registro) {
      return res.status(404).json({
        mensagem: "Arquivo não encontrado.",
      });
    }

    if (
      usuario.tipo !== "ADMIN" &&
      registro.idOrigem !== usuario.id
    ) {
      return res.status(403).json({
        mensagem: "Você não tem permissão para excluir este arquivo.",
      });
    }

    const resultado = await excluirArquivo(id);

    if (!resultado) {
      return res.status(404).json({
        mensagem: "Arquivo não encontrado.",
      });
    }

    return res.status(200).json({
      mensagem: "Arquivo excluído com sucesso.",
      id: resultado.id,
    });
  } catch (erro) {
    next(erro);
  }
};
