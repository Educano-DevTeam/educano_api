-- AlterTable
ALTER TABLE "codigo_validacao" ALTER COLUMN "expira_em" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes');

-- CreateTable
CREATE TABLE "sessao_autenticacao" (
    "id" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "expira_em" TIMESTAMPTZ(3) NOT NULL,
    "revogado_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessao_autenticacao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sessao_autenticacao_token_hash_key" ON "sessao_autenticacao"("token_hash");

-- CreateIndex
CREATE INDEX "sessao_autenticacao_id_usuario_revogado_em_idx" ON "sessao_autenticacao"("id_usuario", "revogado_em");

-- CreateIndex
CREATE INDEX "sessao_autenticacao_expira_em_idx" ON "sessao_autenticacao"("expira_em");

-- AddForeignKey
ALTER TABLE "sessao_autenticacao" ADD CONSTRAINT "sessao_autenticacao_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
