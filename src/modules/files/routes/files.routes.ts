
import { Router, type ErrorRequestHandler } from "express";
import multer from "multer";

import { autenticar } from "../../../middlewares/auth.middlewares.js";

import { uploadArquivo } from "../middleware/upload.middleware.js";

import {
  enviarArquivoController,
  listarArquivosController,
  consultarArquivoController,
  excluirArquivoController,
} from "../controllers/files.controller.js";

const filesRouter = Router();

// Todas as rotas exigem autenticação.
filesRouter.use(autenticar);

// Envio de arquivo.
filesRouter.post(
  "/",
  uploadArquivo.single("arquivo"),
  enviarArquivoController,
);

// Listagem com filtros e paginação.
filesRouter.get(
  "/",
  listarArquivosController,
);

// Consulta individual.
filesRouter.get(
  "/:id",
  consultarArquivoController,
);

// Exclusão.
filesRouter.delete(
  "/:id",
  excluirArquivoController,
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
        mensagem: "O arquivo ultrapassa o tamanho máximo permitido.",
      });
    }

    return res.status(400).json({
      mensagem: "Erro ao receber o arquivo.",
      detalhe: erro.message,
    });
  }

  if (erro instanceof Error) {
    return res.status(400).json({
      mensagem: erro.message,
    });
  }

  next(erro);
};

filesRouter.use(tratarErroUpload);

export default filesRouter;
