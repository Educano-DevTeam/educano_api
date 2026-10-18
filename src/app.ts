import express from "express";
import cors from "cors";
import helmet from "helmet";
import { prisma } from "./config/prisma.js";
import authRouter from "./modules/auth/routes/auth.routes.js";

import rankingRouter from "./modules/ranking/routes/ranking,route.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);

app.use("/api/ranking", rankingRouter);

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    message: "API do Educano funcionando!",
  });
});

app.get("/api/health/database", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    res.status(200).json({
      status: "ok",
      database: "connected",
    });
  } catch (error) {
    console.error("Erro ao conectar ao banco:", error);

    res.status(503).json({
      status: "error",
      message: "Banco de dados indisponível.",
    });
  }
});

export default app;
