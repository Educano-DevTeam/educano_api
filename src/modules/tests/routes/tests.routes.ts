import { Router } from "express";
import { autenticar } from "../../../middlewares/auth.middlewares.js";
import { criar, excluir } from "../controllers/tests.controller.js";

// Atividades dos módulos do curso. Simulados e tentativas ficam em /api/exams.
const testsRouter = Router();

testsRouter.use(autenticar);

testsRouter.post("/", criar);
testsRouter.delete("/:id", excluir);

export default testsRouter;
