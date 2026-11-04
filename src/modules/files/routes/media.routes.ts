import { Router } from "express";

import { redirecionarMidia } from "../controllers/media.controller.js";

// Fotos de perfil e capas de curso são públicas.
const mediaRouter = Router();

mediaRouter.get("/:id", redirecionarMidia);

export default mediaRouter;
