import { Router } from "express";
import { autenticar } from "../../../middlewares/auth.middlewares.js";
import { acessar, concluir, criar, excluir } from "../controllers/lessons.controller.js";

const lessonsRouter = Router();

lessonsRouter.use(autenticar);

lessonsRouter.post("/", criar);
lessonsRouter.delete("/:id", excluir);
lessonsRouter.get("/:id/access", acessar);
lessonsRouter.post("/:id/complete", concluir);

export default lessonsRouter;
