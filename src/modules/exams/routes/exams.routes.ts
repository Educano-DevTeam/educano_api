import { Router } from "express";
import { autenticar } from "../../../middlewares/auth.middlewares.js";
import {
  consultar,
  dica,
  finalizar,
  gerar,
  historico,
  iniciarDaAtividade,
  responder,
} from "../controllers/exams.controller.js";

const examsRouter = Router();

examsRouter.use(autenticar);

examsRouter.get("/", historico);
examsRouter.post("/", gerar);
examsRouter.post("/activities/:idTeste", iniciarDaAtividade);
examsRouter.get("/:id", consultar);
examsRouter.put("/:id/answers/:idQuestao", responder);
examsRouter.post("/:id/questions/:idQuestao/hint", dica);
examsRouter.post("/:id/finish", finalizar);

export default examsRouter;
