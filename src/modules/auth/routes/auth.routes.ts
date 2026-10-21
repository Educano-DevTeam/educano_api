import { Router } from "express";
import {
  login,
  registrar,
  verificarCodigo,
} from "../controllers/auth.controller.js";
import { autenticar } from "../../../middlewares/auth.middlewares.js";
import { consultarSessao } from "../controllers/session.controller.js";

const authRouter = Router();

authRouter.post("/register", registrar);
authRouter.post("/verify-code", verificarCodigo);
authRouter.post("/login", login);
authRouter.get("/me", autenticar, consultarSessao);

export default authRouter;