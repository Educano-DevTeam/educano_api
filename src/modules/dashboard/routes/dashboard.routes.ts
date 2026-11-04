import { Router } from "express";
import {
  autenticar,
  exigirAdmin,
} from "../../../middlewares/auth.middlewares.js";
import { resumo } from "../controllers/dashboard.controller.js";

const dashboardRouter = Router();

dashboardRouter.get("/summary", autenticar, exigirAdmin, resumo);

export default dashboardRouter;
