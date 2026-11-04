import { Router } from "express";
import { autenticar } from "../../../middlewares/auth.middlewares.js";
import {
  atualizar,
  criar,
  excluir,
  listar,
  revisar,
} from "../controllers/flashcards.controller.js";

const flashcardsRouter = Router();

flashcardsRouter.use(autenticar);

flashcardsRouter.get("/", listar);
flashcardsRouter.post("/", criar);
flashcardsRouter.put("/:id", atualizar);
flashcardsRouter.delete("/:id", excluir);
flashcardsRouter.post("/:id/review", revisar);

export default flashcardsRouter;
