-- CreateTable
CREATE TABLE "flashcard" (
    "id" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "titulo" VARCHAR(150) NOT NULL,
    "pergunta" TEXT NOT NULL,
    "resposta" TEXT NOT NULL,
    "repeticoes_mes" INTEGER NOT NULL,
    "ultima_visualizacao" TIMESTAMPTZ(3),
    "proxima_visualizacao" TIMESTAMPTZ(3) NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flashcard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flashcard_id_usuario_idx" ON "flashcard"("id_usuario");

-- CreateIndex
CREATE INDEX "flashcard_id_usuario_proxima_visualizacao_idx" ON "flashcard"("id_usuario", "proxima_visualizacao");

-- AddForeignKey
ALTER TABLE "flashcard" ADD CONSTRAINT "flashcard_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
