import { Router } from "express";

import { autenticar } from "../../../middlewares/auth.middlewares.js";

import {
  criar,
  consultar,
  listar,
  atualizar,
  excluir,
} from "../controllers/courses.controller.js";

const coursesRouter = Router();

// Todas as rotas exigem autenticação.
coursesRouter.use(autenticar);

// Listagem e pesquisa.
coursesRouter.get("/", listar);

// Criação.
coursesRouter.post("/", criar);

// Consulta individual.
coursesRouter.get("/:id", consultar);

// Atualização.
coursesRouter.patch("/:id", atualizar);

// Exclusão.
coursesRouter.delete("/:id", excluir);

export default coursesRouter;