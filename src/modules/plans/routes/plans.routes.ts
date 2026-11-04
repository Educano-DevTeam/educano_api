import { Router } from "express";
import { autenticar } from "../../../middlewares/auth.middlewares.js";
import { assinar, listar } from "../controllers/plans.controller.js";

const plansRouter = Router();

plansRouter.use(autenticar);

plansRouter.get("/", listar);
plansRouter.post("/:id/subscribe", assinar);

export default plansRouter;
