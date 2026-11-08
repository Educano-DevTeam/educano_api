import { Router } from "express";

import {
  autenticar,
  exigirAdmin,
} from "../../../middlewares/auth.middlewares.js";

import {
  criar,
  listar,
  loja,
  consultar,
  atualizar,
  excluir,
  comprar,
} from "../controllers/items.controller.js";

import {
  listar as listarInventario,
  ativar,
  verificar,
} from "../controllers/inventory.controller.js";

const itemsRouter = Router();

itemsRouter.use(autenticar);

// -----------------------------------------------------
// LOJA E INVENTÁRIO
// -----------------------------------------------------

// Rotas estáticas antes de /:id.
itemsRouter.get("/loja", loja);
itemsRouter.get("/inventario", listarInventario);
itemsRouter.patch(
  "/inventario/:idInventario/ativar",
  ativar,
);

itemsRouter.get(
  "/inventario/:idInventario/verificar",
  verificar,
);
// -----------------------------------------------------
// COMPRA
// -----------------------------------------------------

itemsRouter.post("/:id/comprar", comprar);

// -----------------------------------------------------
// ADMINISTRAÇÃO
// -----------------------------------------------------

itemsRouter.post("/", exigirAdmin, criar);
itemsRouter.get("/", exigirAdmin, listar);
itemsRouter.get("/:id", exigirAdmin, consultar);
itemsRouter.patch("/:id", exigirAdmin, atualizar);
itemsRouter.delete("/:id", exigirAdmin, excluir);

export default itemsRouter;