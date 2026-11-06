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

const testsRouter = Router();

testsRouter.use(autenticar);

// Criação
testsRouter.post("/activities", criarAtividadeController);
testsRouter.post("/simulados", criarSimuladoController);

// Consulta
testsRouter.get("/", listar);
testsRouter.get("/:id", consultar);

// Gerenciamento de atividades
testsRouter.patch("/:id", atualizar);
testsRouter.delete("/:id", excluir);

export default testsRouter;