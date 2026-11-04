import { Router } from "express";
import {
  autenticar,
  exigirAdmin,
} from "../../../middlewares/auth.middlewares.js";
import {
  ativar,
  atualizar,
  comprar,
  criar,
  excluir,
  inventario,
  listar,
} from "../controllers/store.controller.js";

export const itemsRouter = Router();

itemsRouter.use(autenticar);

itemsRouter.get("/", listar);
itemsRouter.post("/", exigirAdmin, criar);
itemsRouter.put("/:id", exigirAdmin, atualizar);
itemsRouter.delete("/:id", exigirAdmin, excluir);
itemsRouter.post("/:id/purchase", comprar);

export const inventoryRouter = Router();

inventoryRouter.use(autenticar);

inventoryRouter.get("/", inventario);
inventoryRouter.post("/:id/activate", ativar);
