import { Router } from "express";
import {
  login,
  registrar,
  verificarCodigo,
} from "../controllers/auth.controller.js";

const authRouter = Router();

authRouter.post("/register", registrar);
authRouter.post("/verify-code", verificarCodigo);
authRouter.post("/login", login);

export default authRouter;