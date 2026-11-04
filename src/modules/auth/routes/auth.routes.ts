import { Router } from "express";
import {
  esqueciSenha,
  login,
  redefinir,
  reenviar,
  registrar,
  renovar,
  verificarCodigo,
} from "../controllers/auth.controller.js";
import { autenticar } from "../../../middlewares/auth.middlewares.js";
import { consultarSessao } from "../controllers/session.controller.js";

const authRouter = Router();

authRouter.post("/register", registrar);
authRouter.post("/verify-code", verificarCodigo);
authRouter.post("/resend-code", reenviar);
authRouter.post("/login", login);
authRouter.post("/forgot-password", esqueciSenha);
authRouter.post("/reset-password", redefinir);
authRouter.post("/refresh", autenticar, renovar);
authRouter.get("/me", autenticar, consultarSessao);

export default authRouter;