import { Prisma } from "../../../generated/prisma/client.js";

import type { Request, Response } from "express";

import {
    criarAtividadeSchema,
    criarSimuladoSchema,
    atualizarTesteSchema,
    idTesteParamsSchema,
    listarTestesQuerySchema,
} from "../schemas/tests.schema.js";

import {
    TestsServiceError,
    criarAtividade,
    criarSimulado,
    listarTestes,
    consultarTeste,
    atualizarTeste,
    excluirTeste,
} from "../services/tests.service.js";

function responderErro(res: Response, erro: unknown) {
    if (erro instanceof TestsServiceError) {
        const status: Record<string, number> = {
            ID_INVALIDO: 400,
            SEM_PERMISSAO: 403,
            MODULO_NAO_ENCONTRADO: 404,
            TESTE_NAO_ENCONTRADO: 404,
            QUESTOES_INVALIDAS: 400,
            QUESTOES_INSUFICIENTES: 422,
            SEM_ACESSO_CURSO: 403,
            TIPO_NAO_EDITAVEL: 400,
            TESTE_EM_USO: 409,
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

    console.error("Erro no módulo de testes:", erro);

    return res.status(500).json({
        message: "Não foi possível concluir a solicitação.",
    });
}

// -----------------------------------------------------
// CRIAR ATIVIDADE
// -----------------------------------------------------

export async function criarAtividadeController(
    req: Request,
    res: Response,
) {
    const validacao = criarAtividadeSchema.safeParse(req.body);

    if (!validacao.success) {
        return res.status(400).json({
            message: "Dados inválidos para criação da atividade.",
            errors: validacao.error.issues,
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        const atividade = await criarAtividade(
            usuario.id,
            usuario.tipo,
            validacao.data,
        );

        return res.status(201).json({
            message: "Atividade cadastrada com sucesso.",
            atividade,
        });
    } catch (erro) {
        return responderErro(res, erro);
    }
}

// -----------------------------------------------------
// CRIAR SIMULADO
// -----------------------------------------------------

export async function criarSimuladoController(
    req: Request,
    res: Response,
) {
    const validacao = criarSimuladoSchema.safeParse(req.body);

    if (!validacao.success) {
        return res.status(400).json({
            message: "Dados inválidos para criação do simulado.",
            errors: validacao.error.issues,
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        const simulado = await criarSimulado(
            usuario.id,
            usuario.tipo,
            validacao.data,
        );

        return res.status(201).json({
            message: "Simulado configurado com sucesso.",
            simulado,
        });
    } catch (erro) {
        return responderErro(res, erro);
    }
}

// -----------------------------------------------------
// LISTAR TESTES
// -----------------------------------------------------

export async function listar(req: Request, res: Response) {
    const validacao = listarTestesQuerySchema.safeParse(req.query);

    if (!validacao.success) {
        return res.status(400).json({
            message: "Filtros inválidos.",
            errors: validacao.error.issues,
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        const resultado = await listarTestes(
            usuario.id,
            usuario.tipo,
            validacao.data,
        );

        return res.status(200).json({
            message: "Testes consultados com sucesso.",
            ...resultado,
        });
    } catch (erro) {
        return responderErro(res, erro);
    }
}

// -----------------------------------------------------
// CONSULTAR TESTE
// -----------------------------------------------------

export async function consultar(
    req: Request<{ id: string }>,
    res: Response,
) {
    const validacao = idTesteParamsSchema.safeParse(req.params);

    if (!validacao.success) {
        return res.status(400).json({
            message: "Identificador inválido.",
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        const teste = await consultarTeste(
            validacao.data.id,
            usuario.id,
            usuario.tipo,
        );

        return res.status(200).json({
            message: "Teste consultado com sucesso.",
            teste,
        });
    } catch (erro) {
        return responderErro(res, erro);
    }
}

// -----------------------------------------------------
// ATUALIZAR TESTE
// -----------------------------------------------------

export async function atualizar(
    req: Request<{ id: string }>,
    res: Response,
) {
    const params = idTesteParamsSchema.safeParse(req.params);
    const body = atualizarTesteSchema.safeParse(req.body);

    if (!params.success || !body.success) {
        return res.status(400).json({
            message: "Dados inválidos para atualização.",

            errors: [
                ...(!params.success ? params.error.issues : []),
                ...(!body.success ? body.error.issues : []),
            ],
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        const teste = await atualizarTeste(
            params.data.id,
            usuario.id,
            usuario.tipo,
            body.data,
        );

        return res.status(200).json({
            message: "Atividade atualizada com sucesso.",
            teste,
        });
    } catch (erro) {
        return responderErro(res, erro);
    }
}

// -----------------------------------------------------
// EXCLUIR TESTE
// -----------------------------------------------------

export async function excluir(
    req: Request<{ id: string }>,
    res: Response,
) {
    const validacao = idTesteParamsSchema.safeParse(req.params);

    if (!validacao.success) {
        return res.status(400).json({
            message: "Identificador inválido.",
        });
    }

    try {
        const usuario = req.usuarioAutenticado!;

        await excluirTeste(
            validacao.data.id,
            usuario.id,
            usuario.tipo,
        );

        return res.status(200).json({
            message: "Teste excluído com sucesso.",
        });
    } catch (erro) {
        return responderErro(res, erro);
    }
}