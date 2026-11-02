-- CreateEnum
CREATE TYPE "tipo_arquivo" AS ENUM ('IMAGEM', 'VIDEO', 'AUDIO', 'PDF', 'DOCUMENTO', 'OUTRO');

-- CreateEnum
CREATE TYPE "finalidade_arquivo" AS ENUM ('FOTO_PERFIL', 'BACKGROUND_PERFIL', 'CAPA_CURSO', 'MATERIAL_CURSO', 'MATERIAL_AULA', 'OUTRO');

-- CreateEnum
CREATE TYPE "status_arquivo" AS ENUM ('PENDENTE', 'CONCLUIDO', 'FALHA');

-- AlterTable
ALTER TABLE "codigo_validacao" ALTER COLUMN "expira_em" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes');

-- CreateTable
CREATE TABLE "arquivo" (
    "id" UUID NOT NULL,
    "id_origem" UUID NOT NULL,
    "tipo" "tipo_arquivo" NOT NULL,
    "finalidade" "finalidade_arquivo" NOT NULL,
    "nome_original" VARCHAR(255) NOT NULL,
    "chave_objeto" VARCHAR(512) NOT NULL,
    "bucket" VARCHAR(255) NOT NULL,
    "content_type" VARCHAR(150) NOT NULL,
    "tamanho_bytes" BIGINT NOT NULL,
    "etag" VARCHAR(255),
    "status" "status_arquivo" NOT NULL DEFAULT 'PENDENTE',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "arquivo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "arquivo_chave_objeto_key" ON "arquivo"("chave_objeto");

-- CreateIndex
CREATE INDEX "arquivo_id_origem_idx" ON "arquivo"("id_origem");

-- CreateIndex
CREATE INDEX "arquivo_finalidade_idx" ON "arquivo"("finalidade");

-- CreateIndex
CREATE INDEX "arquivo_tipo_idx" ON "arquivo"("tipo");

-- CreateIndex
CREATE INDEX "arquivo_status_idx" ON "arquivo"("status");

-- AddForeignKey
ALTER TABLE "arquivo" ADD CONSTRAINT "arquivo_id_origem_fkey" FOREIGN KEY ("id_origem") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
