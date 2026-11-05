import {
    Router,
    type ErrorRequestHandler,
} from "express";

import multer from "multer";

import { autenticar } from "../../../middlewares/auth.middlewares.js";

import { uploadArquivo } from "../../files/middleware/upload.middleware.js";

import {
    criar,
    listar,
    consultar,
    atualizar,
    excluir,
} from "../controllers/lessons.controller.js";

const lessonsRouter = Router();

lessonsRouter.use(autenticar);

// Criar aula com envio do material.
lessonsRouter.post(
    "/",
    uploadArquivo.single("arquivo"),
    criar,
);

// Listar aulas de um módulo.
lessonsRouter.get(
    "/",
    listar,
);

// Consultar uma aula e gerar a URL do arquivo.
lessonsRouter.get(
    "/:id",
    consultar,
);

// Editar título e descrição.
lessonsRouter.patch(
    "/:id",
    atualizar,
);

// Excluir aula e material.
lessonsRouter.delete(
    "/:id",
    excluir,
);

// Tratamento dos erros do Multer.
const tratarErroUpload: ErrorRequestHandler = (
    erro,
    _req,
    res,
    next,
) => {
    if (erro instanceof multer.MulterError) {
        if (erro.code === "LIMIT_FILE_SIZE") {
            return res.status(413).json({
                message: "O arquivo ultrapassa o tamanho máximo permitido.",
            });
        }

        return res.status(400).json({
            message: "Erro ao receber o arquivo.",
            detalhe: erro.message,
        });
    }

    if (erro instanceof Error) {
        return res.status(400).json({
            message: erro.message,
        });
    }

    next(erro);
};

lessonsRouter.use(tratarErroUpload);

export default lessonsRouter;