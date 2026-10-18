import { Router } from "express";
import { listarRanking } from "../controllers/ranking.controller.js";

const rankingRouter = Router();

rankingRouter.get("/", listarRanking);

export default rankingRouter;