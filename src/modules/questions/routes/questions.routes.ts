import { Router } from "express";

import { autenticar } from "../../../middlewares/auth.middlewares.js";

import {
    criar,
    listar,
    consultar,
    atualizar,
    excluir,
} from "../controllers/questions.controller.js";

const questionsRouter = Router();

questionsRouter.use(autenticar);

questionsRouter.post("/", criar);

questionsRouter.get("/", listar);

questionsRouter.get("/:id", consultar);

questionsRouter.patch("/:id", atualizar);

questionsRouter.delete("/:id", excluir);

export default questionsRouter;