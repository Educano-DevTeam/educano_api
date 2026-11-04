import { Router } from "express";
import { autenticar } from "../../../middlewares/auth.middlewares.js";
import { criar, excluir } from "../controllers/modules.controller.js";

const modulesRouter = Router();

modulesRouter.use(autenticar);

modulesRouter.post("/", criar);
modulesRouter.delete("/:id", excluir);

export default modulesRouter;
