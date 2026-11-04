import "dotenv/config";
import app from "./app.js";
import { expirarItens } from "./modules/store/services/store.service.js";

const PORT = Number(process.env.PORT) || 3000;

// Rotina que encerra os itens do inventário cujo tempo de uso terminou.
const INTERVALO_EXPIRACAO_MS = 60 * 1000;

function expirarItensAtivos() {
  expirarItens()
    .then((total) => {
      if (total > 0) console.log(`[itens] ${total} item(ns) expirado(s).`);
    })
    .catch((error) => console.error("[itens] Falha na rotina de expiração:", error));
}

app.listen(PORT, () => {
  console.log(`API do Educano rodando na porta ${PORT}`);

  expirarItensAtivos();
  setInterval(expirarItensAtivos, INTERVALO_EXPIRACAO_MS).unref();
});
