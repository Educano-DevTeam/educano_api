import express from "express";
import cors from "cors";
import helmet from "helmet";
import { prisma } from "./config/prisma.js";
import authRouter from "./modules/auth/routes/auth.routes.js";
import usersRouter from "./modules/users/routes/users.routes.js";
import rankingRouter from "./modules/ranking/routes/ranking,route.js";
import filesRouter from "./modules/files/routes/files.routes.js";
import mediaRouter from "./modules/files/routes/media.routes.js";
import coursesRouter from "./modules/courses/routes/courses.routes.js";
import sessionsRouter from "./modules/sessions/routes/sessions.routes.js";
import modulesRouter from "./modules/course-modules/routes/modules.routes.js";
import lessonsRouter from "./modules/lessons/routes/lessons.routes.js";
import testsRouter from "./modules/tests/routes/tests.routes.js";
import enrollmentsRouter from "./modules/enrollments/routes/enrollments.routes.js";
import questionsRouter from "./modules/questions/routes/questions.routes.js";
import examsRouter from "./modules/exams/routes/exams.routes.js";
import { inventoryRouter, itemsRouter } from "./modules/store/routes/store.routes.js";
import plansRouter from "./modules/plans/routes/plans.routes.js";
import flashcardsRouter from "./modules/flashcards/routes/flashcards.routes.js";
import progressRouter from "./modules/progress/routes/progress.routes.js";
import dashboardRouter from "./modules/dashboard/routes/dashboard.routes.js";

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/ranking", rankingRouter);
app.use("/api/files", filesRouter);
app.use("/api/media", mediaRouter);
app.use("/api/courses", coursesRouter);
app.use("/api/sessions", sessionsRouter);
app.use("/api/modules", modulesRouter);
app.use("/api/lessons", lessonsRouter);
app.use("/api/tests", testsRouter);
app.use("/api/enrollments", enrollmentsRouter);
app.use("/api/questions", questionsRouter);
app.use("/api/exams", examsRouter);
app.use("/api/items", itemsRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/plans", plansRouter);
app.use("/api/flashcards", flashcardsRouter);
app.use("/api/progress", progressRouter);
app.use("/api/dashboard", dashboardRouter);

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
