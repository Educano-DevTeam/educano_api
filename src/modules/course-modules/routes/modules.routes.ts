import { Router } from "express";

import { autenticar } from "../../../middlewares/auth.middlewares.js";

import {
  criar,
  listar,
  consultar,
  atualizar,
  excluir,
} from "../controllers/modules.controller.js";

const courseModulesRouter = Router();

courseModulesRouter.use(autenticar);

courseModulesRouter.post("/", criar);
courseModulesRouter.get("/", listar);
courseModulesRouter.get("/:id", consultar);
courseModulesRouter.patch("/:id", atualizar);
courseModulesRouter.delete("/:id", excluir);

export default courseModulesRouter;