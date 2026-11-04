
import { Router } from "express";
import { autenticar, exigirAdmin } from "../../../middlewares/auth.middlewares.js";
import {
  consultarMeuUsuario,
  consultarUsuarioPorIdentificador,
  listar,
  atualizarUsuario,
  removerUsuario,
  atualizarStatus,
  atualizarMeuUsuario,
  atualizarMinhaSenha,
  removerMinhaConta,
} from "../controllers/users.controller.js";
import {
  consultarMeuPerfil,
  consultarPerfilPorIdentificador,
  atualizarMeuPerfil,
  atualizarPerfilPorIdentificador,
  removerPerfil,
  enviarFotoPerfil,
} from "../controllers/profile.controller.js";

const usersRouter = Router();

// Todas as rotas deste módulo exigem login.
usersRouter.use(autenticar);

// Rotas próprias: devem vir antes de /:identifier.
usersRouter.get("/me", consultarMeuUsuario);
usersRouter.patch("/me", atualizarMeuUsuario);
// Exclusão da própria conta.
usersRouter.delete("/me", removerMinhaConta);
usersRouter.patch("/me/password", atualizarMinhaSenha);
usersRouter.get("/me/profile", consultarMeuPerfil);
usersRouter.patch("/me/profile", atualizarMeuPerfil);
usersRouter.post("/me/profile/photo", enviarFotoPerfil);

// Listagem completa: somente administradores.
usersRouter.get("/", exigirAdmin, listar);

// Usuários por ID ou e-mail.
usersRouter.get("/:identifier", consultarUsuarioPorIdentificador);
usersRouter.patch("/:identifier", exigirAdmin, atualizarUsuario);
usersRouter.delete("/:identifier", exigirAdmin, removerUsuario);
usersRouter.patch("/:identifier/status", exigirAdmin, atualizarStatus);

// Perfis por ID ou e-mail.
usersRouter.get(
  "/:identifier/profile",
  consultarPerfilPorIdentificador,
);
usersRouter.patch(
  "/:identifier/profile",
  exigirAdmin,
  atualizarPerfilPorIdentificador,
);
usersRouter.delete(
  "/:identifier/profile",
  exigirAdmin,
  removerPerfil,
);

export default usersRouter;
