/*
  Warnings:

  - A unique constraint covering the columns `[id_questao,letra]` on the table `alternativa` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `letra` to the `alternativa` table without a default value. This is not possible if the table is not empty.
  - Added the required column `id_responsavel` to the `teste_questao` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "alternativa" ADD COLUMN     "letra" VARCHAR(1) NOT NULL;

-- AlterTable
ALTER TABLE "codigo_validacao" ALTER COLUMN "expira_em" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes');

-- AlterTable
ALTER TABLE "teste" ADD COLUMN     "dificuldade" "nivel_dificuldade";

-- AlterTable
ALTER TABLE "teste_questao" ADD COLUMN     "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "id_responsavel" UUID NOT NULL;

-- CreateTable
CREATE TABLE "tentativa_teste" (
    "id" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "id_teste" UUID NOT NULL,
    "tempo_consumido" INTEGER,
    "nota_final" DECIMAL(5,2),
    "iniciado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviado_em" TIMESTAMPTZ(3),

    CONSTRAINT "tentativa_teste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tentativa_questao" (
    "id" UUID NOT NULL,
    "id_tentativa" UUID NOT NULL,
    "id_questao" UUID NOT NULL,
    "enunciado" TEXT NOT NULL,
    "alternativa_a" TEXT,
    "alternativa_b" TEXT,
    "alternativa_c" TEXT,
    "alternativa_d" TEXT,
    "alternativa_e" TEXT,
    "resposta_correta" VARCHAR(1) NOT NULL,
    "resposta_usuario" VARCHAR(1),
    "acertou" BOOLEAN,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usuarioId" UUID,

    CONSTRAINT "tentativa_questao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tentativa_teste_id_usuario_idx" ON "tentativa_teste"("id_usuario");

-- CreateIndex
CREATE INDEX "tentativa_teste_id_teste_idx" ON "tentativa_teste"("id_teste");

-- CreateIndex
CREATE INDEX "tentativa_teste_enviado_em_idx" ON "tentativa_teste"("enviado_em");

-- CreateIndex
CREATE INDEX "tentativa_questao_id_questao_idx" ON "tentativa_questao"("id_questao");

-- CreateIndex
CREATE UNIQUE INDEX "tentativa_questao_id_tentativa_id_questao_key" ON "tentativa_questao"("id_tentativa", "id_questao");

-- CreateIndex
CREATE UNIQUE INDEX "alternativa_id_questao_letra_key" ON "alternativa"("id_questao", "letra");

-- AddForeignKey
ALTER TABLE "teste_questao" ADD CONSTRAINT "teste_questao_id_responsavel_fkey" FOREIGN KEY ("id_responsavel") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentativa_teste" ADD CONSTRAINT "tentativa_teste_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentativa_teste" ADD CONSTRAINT "tentativa_teste_id_teste_fkey" FOREIGN KEY ("id_teste") REFERENCES "teste"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentativa_questao" ADD CONSTRAINT "tentativa_questao_id_tentativa_fkey" FOREIGN KEY ("id_tentativa") REFERENCES "tentativa_teste"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentativa_questao" ADD CONSTRAINT "tentativa_questao_id_questao_fkey" FOREIGN KEY ("id_questao") REFERENCES "questao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentativa_questao" ADD CONSTRAINT "tentativa_questao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;
