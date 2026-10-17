-- CreateEnum
CREATE TYPE "tipo_usuario" AS ENUM ('aluno', 'professor', 'parceiro', 'admin');

-- CreateEnum
CREATE TYPE "status_usuario" AS ENUM ('pendente', 'ativo', 'inativo');

-- CreateEnum
CREATE TYPE "tipo_perfil" AS ENUM ('publico', 'privado');

-- CreateTable
CREATE TABLE "usuario" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "senha" VARCHAR(255) NOT NULL,
    "tipo" "tipo_usuario" NOT NULL DEFAULT 'aluno',
    "status" "status_usuario" NOT NULL DEFAULT 'pendente',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "perfil" (
    "id_usuario" UUID NOT NULL,
    "tipo_perfil" "tipo_perfil" NOT NULL DEFAULT 'privado',
    "plano_conta" UUID,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "moedas" INTEGER NOT NULL DEFAULT 0,
    "nivel" INTEGER NOT NULL DEFAULT 0,
    "cor" VARCHAR(30) NOT NULL DEFAULT '',
    "decoracao" UUID,
    "url_foto_perfil" TEXT NOT NULL DEFAULT '',
    "url_foto_background" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "perfil_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- AddForeignKey
ALTER TABLE "perfil" ADD CONSTRAINT "perfil_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
