
import type { Request, Response } from "express";

import {
    enviarRespostasSchema,
    idTentativaParamsSchema,
    listarTentativasQuerySchema,
} from "../schemas/attempts.schema.js";

import {
    AttemptsServiceError,
    iniciarTentativa,
    enviarRespostas,
    listarTentativas,
    consultarTentativa,
} from "../services/attempts.service.js";

function responderErro(res: Response, erro: unknown) {
    if (erro instanceof AttemptsServiceError) {
        const status: Record<string, number> = {
            TESTE_NAO_ENCONTRADO: 404,
            TENTATIVA_NAO_ENCONTRADA: 404,
            CURSO_INDISPONIVEL: 403,
            SEM_ACESSO_CURSO: 403,
            SEM_PERMISSAO: 403,
            QUESTOES_INSUFICIENTES: 422,
            SEM_QUESTOES: 422,
            QUESTOES_INCOMPLETAS: 422,
            TENTATIVA_FINALIZADA: 409,
            RESPOSTAS_INVALIDAS: 400,
        };

        return res.status(status[erro.code] ?? 400).json({
            message: erro.message,
        });
    }

    console.error("Erro no módulo de tentativas:", erro);

    return res.status(500).json({
        message: "Não foi possível concluir a solicitação.",
    });
}

// -----------------------------------------------------
// INICIAR TENTATIVA
// POST /:id/attempts
// -----------------------------------------------------

export async function iniciar(
    req: Request<{ id: string }>,
    res: Response,
) {
    const params = idTentativaParamsSchema.safeParse(req.params);

    if (!params.success) {
        return res.status(400).json({
            message: "Identificador inválido.",
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        const resultado = await iniciarTentativa(
            params.data.id,
            usuario.id,
        );

        return res.status(201).json({
            message: "Tentativa iniciada com sucesso.",
            ...resultado,
        });
    } catch (erro) {
        return responderErro(res, erro);
    }
}

// -----------------------------------------------------
// ENVIAR RESPOSTAS
// POST /attempts/:id/submit
// -----------------------------------------------------

export async function enviar(
    req: Request<{ id: string }>,
    res: Response,
) {
    const params = idTentativaParamsSchema.safeParse(req.params);
    const body = enviarRespostasSchema.safeParse(req.body);

    if (!params.success || !body.success) {
        return res.status(400).json({
            message: "Dados inválidos para envio das respostas.",
            errors: [
                ...(!params.success ? params.error.issues : []),
                ...(!body.success ? body.error.issues : []),
            ],
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        const resultado = await enviarRespostas(
            params.data.id,
            usuario.id,
            body.data.respostas,
        );

        return res.status(200).json({
            message: "Respostas enviadas com sucesso.",
            ...resultado,
        });
    } catch (erro) {
        return responderErro(res, erro);
    }
}

// -----------------------------------------------------
// LISTAR TENTATIVAS
// GET /attempts
// -----------------------------------------------------

export async function listar(req: Request, res: Response) {
    const validacao = listarTentativasQuerySchema.safeParse(req.query);

    if (!validacao.success) {
        return res.status(400).json({
            message: "Filtros inválidos.",
            errors: validacao.error.issues,
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        const resultado = await listarTentativas(
            usuario.id,
            validacao.data.pagina,
            validacao.data.limite,
        );

        return res.status(200).json({
            message: "Tentativas consultadas com sucesso.",
            ...resultado,
        });
    } catch (erro) {
        return responderErro(res, erro);
    }
}

// -----------------------------------------------------
// CONSULTAR TENTATIVA
// GET /attempts/:id
// -----------------------------------------------------

export async function consultar(
    req: Request<{ id: string }>,
    res: Response,
) {
    const params = idTentativaParamsSchema.safeParse(req.params);

    if (!params.success) {
        return res.status(400).json({
            message: "Identificador inválido.",
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        const resultado = await consultarTentativa(
            params.data.id,
            usuario.id,
        );

        return res.status(200).json({
            message: "Tentativa consultada com sucesso.",
            tentativa: resultado,
        });
    } catch (erro) {
        return responderErro(res, erro);
    }
}
