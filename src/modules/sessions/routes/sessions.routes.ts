import { Router } from "express";
import { autenticar } from "../../../middlewares/auth.middlewares.js";
import { criar, excluir } from "../controllers/sessions.controller.js";

const sessionsRouter = Router();

sessionsRouter.use(autenticar);

sessionsRouter.post("/", criar);
sessionsRouter.delete("/:id", excluir);

export default sessionsRouter;
