-- CreateEnum
CREATE TYPE "status_codigo_validacao" AS ENUM ('ativo', 'inativo', 'usado');

-- CreateTable
CREATE TABLE "codigo_validacao" (
    "id" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "codigo" VARCHAR(64) NOT NULL,
    "data_criacao" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMPTZ(3) NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes'),
    "status" "status_codigo_validacao" NOT NULL DEFAULT 'ativo',

    CONSTRAINT "codigo_validacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "codigo_validacao_id_usuario_status_idx" ON "codigo_validacao"("id_usuario", "status");

-- CreateIndex
CREATE INDEX "codigo_validacao_expira_em_status_idx" ON "codigo_validacao"("expira_em", "status");

-- AddForeignKey
ALTER TABLE "codigo_validacao" ADD CONSTRAINT "codigo_validacao_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
