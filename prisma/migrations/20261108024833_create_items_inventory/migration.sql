-- CreateEnum
CREATE TYPE "categoria_item" AS ENUM ('BOOST');

-- CreateEnum
CREATE TYPE "icone_item" AS ENUM ('RAIO', 'ESCUDO', 'LAMPADA', 'CRONOMETRO', 'REINICIAR', 'AVATAR', 'ESTRELA');

-- CreateEnum
CREATE TYPE "status_item" AS ENUM ('ATIVO', 'INATIVO');

-- CreateEnum
CREATE TYPE "status_inventario" AS ENUM ('NAO_USADO', 'ATIVO', 'USADO');

-- AlterTable
ALTER TABLE "codigo_validacao" ALTER COLUMN "expira_em" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes');

-- CreateTable
CREATE TABLE "item" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "descricao" TEXT NOT NULL,
    "preco" INTEGER NOT NULL,
    "categoria" "categoria_item" NOT NULL DEFAULT 'BOOST',
    "icone" "icone_item" NOT NULL,
    "boost" DOUBLE PRECISION NOT NULL,
    "tempo_uso" INTEGER NOT NULL,
    "cor" VARCHAR(30) NOT NULL,
    "status" "status_item" NOT NULL DEFAULT 'ATIVO',
    "id_responsavel" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventario" (
    "id" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "id_item" UUID NOT NULL,
    "status" "status_inventario" NOT NULL DEFAULT 'NAO_USADO',
    "comprado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMPTZ(3),

    CONSTRAINT "inventario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "item_categoria_idx" ON "item"("categoria");

-- CreateIndex
CREATE INDEX "item_status_idx" ON "item"("status");

-- CreateIndex
CREATE INDEX "item_id_responsavel_idx" ON "item"("id_responsavel");

-- CreateIndex
CREATE INDEX "inventario_id_usuario_status_idx" ON "inventario"("id_usuario", "status");

-- CreateIndex
CREATE INDEX "inventario_id_item_idx" ON "inventario"("id_item");

-- CreateIndex
CREATE INDEX "inventario_expira_em_idx" ON "inventario"("expira_em");

-- AddForeignKey
ALTER TABLE "item" ADD CONSTRAINT "item_id_responsavel_fkey" FOREIGN KEY ("id_responsavel") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario" ADD CONSTRAINT "inventario_id_item_fkey" FOREIGN KEY ("id_item") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
