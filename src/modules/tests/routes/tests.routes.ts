
import { Router } from "express";

import { autenticar } from "../../../middlewares/auth.middlewares.js";

import {
    criarAtividadeController,
    criarSimuladoController,
    listar,
    consultar,
    atualizar,
    excluir,
} from "../controllers/tests.controller.js";

import {
    iniciar,
    enviar,
    listar as listarTentativasController,
    consultar as consultarTentativaController,
} from "../controllers/attempts.controller.js";

const testsRouter = Router();

testsRouter.use(autenticar);

// Criação
testsRouter.post("/activities", criarAtividadeController);
testsRouter.post("/simulados", criarSimuladoController);

// Tentativas e respostas
testsRouter.post("/:id/attempts", iniciar);
testsRouter.post("/attempts/:id/submit", enviar);
testsRouter.get("/attempts", listarTentativasController);
testsRouter.get("/attempts/:id", consultarTentativaController);

// Consulta e gerenciamento dos testes
testsRouter.get("/", listar);
testsRouter.get("/:id", consultar);
testsRouter.patch("/:id", atualizar);
testsRouter.delete("/:id", excluir);

export default testsRouter;
