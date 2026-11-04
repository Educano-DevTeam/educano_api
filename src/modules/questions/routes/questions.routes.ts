import { Router } from "express";
import {
  autenticar,
  exigirTipos,
} from "../../../middlewares/auth.middlewares.js";
import {
  atualizar,
  consultar,
  criar,
  excluir,
  listar,
  relatorio,
} from "../controllers/questions.controller.js";

// O banco de questões contém os gabaritos: acesso restrito à equipe.
const questionsRouter = Router();

questionsRouter.use(autenticar, exigirTipos("ADMIN", "PARCEIRO", "PROFESSOR"));

questionsRouter.get("/", listar);
questionsRouter.get("/report", relatorio);
questionsRouter.get("/:id", consultar);
questionsRouter.post("/", criar);
questionsRouter.put("/:id", atualizar);
questionsRouter.delete("/:id", excluir);

export default questionsRouter;
