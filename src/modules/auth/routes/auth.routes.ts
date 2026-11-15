import { Router } from "express";
import {
  login,
  registrar,
  verificarCodigo,
  solicitarCodigoRecuperacao,
  redefinirSenhaUsuario,
} from "../controllers/auth.controller.js";
import { autenticar } from "../../../middlewares/auth.middlewares.js";
import { consultarSessao } from "../controllers/session.controller.js";

const authRouter = Router();

authRouter.post("/register", registrar);
authRouter.post("/verify-code", verificarCodigo);
authRouter.post("/login", login);

authRouter.post("/forgot-password", solicitarCodigoRecuperacao);
authRouter.post("/reset-password", redefinirSenhaUsuario);

authRouter.get("/me", autenticar, consultarSessao);

export default authRouter;