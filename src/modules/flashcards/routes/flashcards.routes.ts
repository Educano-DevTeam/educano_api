import { Router } from "express";

import { autenticar } from "../../../middlewares/auth.middlewares.js";

import {
  criar,
  listar,
  consultar,
  atualizar,
  excluir,
  visualizar,
} from "../controllers/flashcards.controller.js";

const flashcardsRouter = Router();

flashcardsRouter.use(autenticar);

// CRUD
flashcardsRouter.post("/", criar);

flashcardsRouter.get("/", listar);

flashcardsRouter.get("/:id", consultar);

flashcardsRouter.patch("/:id", atualizar);

flashcardsRouter.delete("/:id", excluir);

// Registro de visualização
flashcardsRouter.post("/:id/visualizar", visualizar);

export default flashcardsRouter;