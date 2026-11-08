
import { Router } from "express";

import { autenticar } from "../../../middlewares/auth.middlewares.js";
import { uploadArquivo } from "../../files/middleware/upload.middleware.js";

import {
  criar,
  consultar,
  consultarConteudo,
  listar,
  listarMeusCursos, 
  atualizar,
  excluir,
} from "../controllers/courses.controller.js";

import {
  inscrever,
  consultarMinha,
  cancelarMinha,
  listarInscritosController,
  listarDisponiveis,
  listarVinculados,
  vincular,
  desvincular,
} from "../controllers/course-access.controllert.js";

const coursesRouter = Router();

coursesRouter.use(autenticar);

// Cursos
coursesRouter.get("/", listar);
coursesRouter.post("/", uploadArquivo.single("arquivo"), criar);

// Cursos inscritos pelo próprio usuário.
coursesRouter.get("/minhas-inscricoes", listarMeusCursos);

// Inscrições do próprio usuário
coursesRouter.post("/:id/inscricoes", inscrever);
coursesRouter.get("/:id/inscricoes/me", consultarMinha);
coursesRouter.delete("/:id/inscricoes/me", cancelarMinha);

// Listagem administrativa de inscritos
coursesRouter.get("/:id/inscricoes", listarInscritosController);

// Gerenciamento de professores
coursesRouter.get(
  "/:id/professores/disponiveis",
  listarDisponiveis,
);
coursesRouter.get("/:id/professores", listarVinculados);
coursesRouter.post("/:id/professores", vincular);
coursesRouter.delete(
  "/:id/professores/:idProfessor",
  desvincular,
);

// Consulta completa do curso e seus conteúdos.
coursesRouter.get("/:id/conteudo", consultarConteudo);

// Consulta básica, atualização e exclusão.
coursesRouter.get("/:id", consultar);
coursesRouter.patch(
  "/:id",
  uploadArquivo.single("arquivo"),
  atualizar,
);
coursesRouter.delete("/:id", excluir);

export default coursesRouter;
