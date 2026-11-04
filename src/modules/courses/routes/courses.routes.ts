import { Router } from "express";

import { autenticar } from "../../../middlewares/auth.middlewares.js";

import { uploadArquivo } from "../../files/middleware/upload.middleware.js";

import {
  criar,
  consultar,
  listar,
  atualizar,
  excluir,
} from "../controllers/courses.controller.js";
import {
  consultarConteudo,
  salvarConteudo,
} from "../controllers/estrutura.controller.js";

const coursesRouter = Router();

coursesRouter.use(autenticar);

coursesRouter.get("/", listar);

// O arquivo deve ser enviado no campo "arquivo".
coursesRouter.post("/", uploadArquivo.single("arquivo"), criar);

coursesRouter.get("/:id", consultar);

coursesRouter.patch(
  "/:id",
  uploadArquivo.single("arquivo"),
  atualizar,
);

coursesRouter.delete("/:id", excluir);

// Sessões, módulos, aulas e atividades do curso, com o progresso do usuário.
coursesRouter.get("/:id/estrutura", consultarConteudo);
coursesRouter.put("/:id/estrutura", salvarConteudo);

export default coursesRouter;