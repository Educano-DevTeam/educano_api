import { Router } from "express";
import {
  registrar,
  verificarCodigo,
} from "./controllers/auth.controller.js";

const authRouter = Router();

authRouter.post("/register", registrar);
authRouter.post("/verify-code", verificarCodigo);

export default authRouter;