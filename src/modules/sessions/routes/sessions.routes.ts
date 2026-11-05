import { Router } from "express";

import { autenticar } from "../../../middlewares/auth.middlewares.js";

import {
  criar,
  listar,
  consultar,
  atualizar,
  excluir,
} from "../controllers/sessions.controller.js";

const sessionsRouter = Router();

sessionsRouter.use(autenticar);

sessionsRouter.post("/", criar);
sessionsRouter.get("/", listar);
sessionsRouter.get("/:id", consultar);
sessionsRouter.patch("/:id", atualizar);
sessionsRouter.delete("/:id", excluir);

export default sessionsRouter;