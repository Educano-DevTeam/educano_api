import { Prisma } from "../../../generated/prisma/client.js";

import type { Request, Response } from "express";

import {
    criarQuestaoSchema,
    atualizarQuestaoSchema,
    idQuestaoParamsSchema,
    listarQuestoesQuerySchema,
} from "../schemas/questions.schema.js";

import {
    QuestionsServiceError,
    criarQuestao,
    listarQuestoes,
    consultarQuestao,
    atualizarQuestao,
    excluirQuestao,
} from "../services/questions.service.js";

function responderErro(res: Response, erro: unknown) {
    if (erro instanceof QuestionsServiceError) {
        const status: Record<string, number> = {
            ID_INVALIDO: 400,

            SEM_PERMISSAO: 403,

            QUESTAO_NAO_ENCONTRADA: 404,

            QUESTAO_EM_USO: 409,

            ALTERNATIVA_CORRETA_INVALIDA: 400,
        };

        return res.status(status[erro.code] ?? 400).json({
            message: erro.message,
        });
    }

    if (
        erro instanceof Prisma.PrismaClientKnownRequestError &&
        erro.code === "P2025"
    ) {
        return res.status(404).json({
            message: "Registro não encontrado.",
        });
    }

    console.error("Erro no módulo de questões:", erro);

    return res.status(500).json({
        message: "Não foi possível concluir a solicitação.",
    });
}

// -----------------------------------------------------
// CRIAR QUESTÃO
// -----------------------------------------------------

export async function criar(req: Request, res: Response) {
    const validacao = criarQuestaoSchema.safeParse(req.body);

    if (!validacao.success) {
        return res.status(400).json({
            message: "Dados inválidos para criação da questão.",
            errors: validacao.error.issues,
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        const questao = await criarQuestao(
            usuario.id,
            usuario.tipo,
            validacao.data,
        );

        return res.status(201).json({
            message: "Questão cadastrada com sucesso.",
            questao,
        });
    } catch (erro) {
        return responderErro(res, erro);
    }
}

// -----------------------------------------------------
// LISTAR QUESTÕES
// -----------------------------------------------------

export async function listar(req: Request, res: Response) {
    const validacao = listarQuestoesQuerySchema.safeParse(req.query);

    if (!validacao.success) {
        return res.status(400).json({
            message: "Filtros inválidos.",
            errors: validacao.error.issues,
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        const resultado = await listarQuestoes(
            usuario.id,
            usuario.tipo,
            validacao.data,
        );

        return res.status(200).json({
            message: "Questões consultadas com sucesso.",
            ...resultado,
        });
    } catch (erro) {
        return responderErro(res, erro);
    }
}

// -----------------------------------------------------
// CONSULTAR QUESTÃO
// -----------------------------------------------------

export async function consultar(
    req: Request<{ id: string }>,
    res: Response,
) {
    const validacao = idQuestaoParamsSchema.safeParse(req.params);

    if (!validacao.success) {
        return res.status(400).json({
            message: "Identificador da questão inválido.",
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        const questao = await consultarQuestao(
            validacao.data.id,
            usuario.id,
            usuario.tipo,
        );

        return res.status(200).json({
            message: "Questão consultada com sucesso.",
            questao,
        });
    } catch (erro) {
        return responderErro(res, erro);
    }
}

// -----------------------------------------------------
// ATUALIZAR QUESTÃO
// -----------------------------------------------------

export async function atualizar(
    req: Request<{ id: string }>,
    res: Response,
) {
    const params = idQuestaoParamsSchema.safeParse(req.params);
    const body = atualizarQuestaoSchema.safeParse(req.body);

    if (!params.success || !body.success) {
        return res.status(400).json({
            message: "Dados inválidos para atualização da questão.",

            errors: [
                ...(!params.success ? params.error.issues : []),
                ...(!body.success ? body.error.issues : []),
            ],
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        const questao = await atualizarQuestao(
            params.data.id,
            usuario.id,
            usuario.tipo,
            body.data,
        );

        return res.status(200).json({
            message: "Questão atualizada com sucesso.",
            questao,
        });
    } catch (erro) {
        return responderErro(res, erro);
    }
}

// -----------------------------------------------------
// EXCLUIR QUESTÃO
// -----------------------------------------------------

export async function excluir(
    req: Request<{ id: string }>,
    res: Response,
) {
    const validacao = idQuestaoParamsSchema.safeParse(req.params);

    if (!validacao.success) {
        return res.status(400).json({
            message: "Identificador da questão inválido.",
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        await excluirQuestao(
            validacao.data.id,
            usuario.id,
            usuario.tipo,
        );

        return res.status(200).json({
            message: "Questão excluída com sucesso.",
        });
    } catch (erro) {
        return responderErro(res, erro);
    }
}