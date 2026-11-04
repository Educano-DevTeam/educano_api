import { Router } from "express";
import { autenticar } from "../../../middlewares/auth.middlewares.js";
import { meuProgresso } from "../controllers/progress.controller.js";

const progressRouter = Router();

progressRouter.get("/me", autenticar, meuProgresso);

export default progressRouter;
