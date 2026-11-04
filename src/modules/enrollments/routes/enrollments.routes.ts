import { Router } from "express";
import { autenticar } from "../../../middlewares/auth.middlewares.js";
import {
  cancelar,
  inscrever,
  inscreverOutroUsuario,
  inscritosDoCurso,
  meusCursos,
} from "../controllers/enrollments.controller.js";

const enrollmentsRouter = Router();

enrollmentsRouter.use(autenticar);

enrollmentsRouter.post("/", inscrever);
enrollmentsRouter.get("/me", meusCursos);
enrollmentsRouter.delete("/:idCurso", cancelar);

// Gestão de inscritos (responsável pelo curso ou administrador).
enrollmentsRouter.get("/curso/:idCurso", inscritosDoCurso);
enrollmentsRouter.post("/curso/:idCurso", inscreverOutroUsuario);

export default enrollmentsRouter;
