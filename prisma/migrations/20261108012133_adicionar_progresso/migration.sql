-- AlterTable
ALTER TABLE "codigo_validacao" ALTER COLUMN "expira_em" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes');

-- CreateTable
CREATE TABLE "progresso" (
    "id" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "id_aula" UUID,
    "id_teste" UUID,
    "concluida" BOOLEAN NOT NULL DEFAULT false,
    "concluido_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "progresso_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "progresso_id_usuario_idx" ON "progresso"("id_usuario");

-- CreateIndex
CREATE INDEX "progresso_id_aula_idx" ON "progresso"("id_aula");

-- CreateIndex
CREATE INDEX "progresso_id_teste_idx" ON "progresso"("id_teste");

-- CreateIndex
CREATE UNIQUE INDEX "progresso_id_usuario_id_aula_key" ON "progresso"("id_usuario", "id_aula");

-- CreateIndex
CREATE UNIQUE INDEX "progresso_id_usuario_id_teste_key" ON "progresso"("id_usuario", "id_teste");

-- AddForeignKey
ALTER TABLE "progresso" ADD CONSTRAINT "progresso_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progresso" ADD CONSTRAINT "progresso_id_aula_fkey" FOREIGN KEY ("id_aula") REFERENCES "aula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progresso" ADD CONSTRAINT "progresso_id_teste_fkey" FOREIGN KEY ("id_teste") REFERENCES "teste"("id") ON DELETE CASCADE ON UPDATE CASCADE;
