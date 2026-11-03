-- CreateEnum
CREATE TYPE "categoria_curso" AS ENUM ('LINGUAGENS', 'EXATAS', 'CIENCIAS_HUMANAS', 'CIENCIAS_NATURAIS', 'REDACAO', 'VESTIBULAR', 'TECNOLOGIA', 'INTELIGENCIA_ARTIFICIAL', 'DESIGN', 'FINANCAS');

-- CreateEnum
CREATE TYPE "status_curso" AS ENUM ('RASCUNHO', 'INATIVO', 'ATIVO');

-- CreateEnum
CREATE TYPE "tipo_capa_curso" AS ENUM ('ICONE', 'URL');

-- CreateEnum
CREATE TYPE "tipo_material" AS ENUM ('VIDEO', 'AUDIO', 'PDF', 'DOCUMENTO', 'OUTRO');

-- CreateEnum
CREATE TYPE "tipo_teste" AS ENUM ('SIMULADO', 'ATIVIDADE');

-- CreateEnum
CREATE TYPE "nivel_dificuldade" AS ENUM ('FACIL', 'MEDIO', 'DIFICIL');

-- AlterTable
ALTER TABLE "codigo_validacao" ALTER COLUMN "expira_em" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes');

-- CreateTable
CREATE TABLE "curso" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "categoria" "categoria_curso" NOT NULL,
    "status" "status_curso" NOT NULL DEFAULT 'INATIVO',
    "vagas" INTEGER,
    "preco" DECIMAL(10,2),
    "descricao" TEXT,
    "cor" VARCHAR(30),
    "id_capa" UUID,
    "id_responsavel" UUID NOT NULL,
    "id_admin_autorizador" UUID,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,
    "autorizado_em" TIMESTAMPTZ(3),

    CONSTRAINT "curso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessao" (
    "id" UUID NOT NULL,
    "id_curso" UUID NOT NULL,
    "titulo" VARCHAR(150) NOT NULL,
    "subtitulo" VARCHAR(200),
    "descricao" TEXT,
    "id_responsavel" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "modulo" (
    "id" UUID NOT NULL,
    "id_sessao" UUID NOT NULL,
    "titulo" VARCHAR(150) NOT NULL,
    "descricao" TEXT,
    "id_responsavel" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "modulo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aula" (
    "id" UUID NOT NULL,
    "id_modulo" UUID NOT NULL,
    "titulo" VARCHAR(150) NOT NULL,
    "descricao" TEXT,
    "id_arquivo" UUID,
    "tipo" "tipo_material" NOT NULL,
    "quantidade_paginas" INTEGER,
    "duracao_minutos" INTEGER,
    "id_responsavel" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "aula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teste" (
    "id" UUID NOT NULL,
    "id_modulo" UUID,
    "id_responsavel" UUID NOT NULL,
    "tipo" "tipo_teste" NOT NULL,
    "tema" VARCHAR(150),
    "tempo_minutos" INTEGER NOT NULL DEFAULT 5,
    "quantidade_questoes" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "teste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questao" (
    "id" UUID NOT NULL,
    "id_responsavel" UUID NOT NULL,
    "id_alternativa_correta" UUID,
    "titulo" VARCHAR(150),
    "enunciado" TEXT NOT NULL,
    "dificuldade" "nivel_dificuldade" NOT NULL DEFAULT 'MEDIO',
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "questao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alternativa" (
    "id" UUID NOT NULL,
    "id_questao" UUID NOT NULL,
    "id_responsavel" UUID NOT NULL,
    "texto" TEXT NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "alternativa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "teste_questao" (
    "id" UUID NOT NULL,
    "id_teste" UUID NOT NULL,
    "id_questao" UUID NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "teste_questao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inscricao" (
    "id" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "id_curso" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inscricao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "curso_id_capa_key" ON "curso"("id_capa");

-- CreateIndex
CREATE INDEX "curso_nome_idx" ON "curso"("nome");

-- CreateIndex
CREATE INDEX "curso_categoria_idx" ON "curso"("categoria");

-- CreateIndex
CREATE INDEX "curso_status_idx" ON "curso"("status");

-- CreateIndex
CREATE INDEX "curso_id_responsavel_idx" ON "curso"("id_responsavel");

-- CreateIndex
CREATE INDEX "sessao_id_curso_idx" ON "sessao"("id_curso");

-- CreateIndex
CREATE INDEX "sessao_id_responsavel_idx" ON "sessao"("id_responsavel");

-- CreateIndex
CREATE INDEX "modulo_id_sessao_idx" ON "modulo"("id_sessao");

-- CreateIndex
CREATE INDEX "modulo_id_responsavel_idx" ON "modulo"("id_responsavel");

-- CreateIndex
CREATE UNIQUE INDEX "aula_id_arquivo_key" ON "aula"("id_arquivo");

-- CreateIndex
CREATE INDEX "aula_id_modulo_idx" ON "aula"("id_modulo");

-- CreateIndex
CREATE INDEX "aula_id_responsavel_idx" ON "aula"("id_responsavel");

-- CreateIndex
CREATE INDEX "teste_id_modulo_idx" ON "teste"("id_modulo");

-- CreateIndex
CREATE INDEX "teste_id_responsavel_idx" ON "teste"("id_responsavel");

-- CreateIndex
CREATE INDEX "teste_tipo_idx" ON "teste"("tipo");

-- CreateIndex
CREATE INDEX "questao_id_responsavel_idx" ON "questao"("id_responsavel");

-- CreateIndex
CREATE INDEX "questao_id_alternativa_correta_idx" ON "questao"("id_alternativa_correta");

-- CreateIndex
CREATE INDEX "questao_dificuldade_idx" ON "questao"("dificuldade");

-- CreateIndex
CREATE INDEX "alternativa_id_questao_idx" ON "alternativa"("id_questao");

-- CreateIndex
CREATE INDEX "alternativa_id_responsavel_idx" ON "alternativa"("id_responsavel");

-- CreateIndex
CREATE INDEX "teste_questao_id_questao_idx" ON "teste_questao"("id_questao");

-- CreateIndex
CREATE UNIQUE INDEX "teste_questao_id_teste_id_questao_key" ON "teste_questao"("id_teste", "id_questao");

-- CreateIndex
CREATE INDEX "inscricao_id_curso_idx" ON "inscricao"("id_curso");

-- CreateIndex
CREATE UNIQUE INDEX "inscricao_id_usuario_id_curso_key" ON "inscricao"("id_usuario", "id_curso");

-- AddForeignKey
ALTER TABLE "curso" ADD CONSTRAINT "curso_id_capa_fkey" FOREIGN KEY ("id_capa") REFERENCES "arquivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso" ADD CONSTRAINT "curso_id_responsavel_fkey" FOREIGN KEY ("id_responsavel") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso" ADD CONSTRAINT "curso_id_admin_autorizador_fkey" FOREIGN KEY ("id_admin_autorizador") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_id_curso_fkey" FOREIGN KEY ("id_curso") REFERENCES "curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessao" ADD CONSTRAINT "sessao_id_responsavel_fkey" FOREIGN KEY ("id_responsavel") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modulo" ADD CONSTRAINT "modulo_id_sessao_fkey" FOREIGN KEY ("id_sessao") REFERENCES "sessao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "modulo" ADD CONSTRAINT "modulo_id_responsavel_fkey" FOREIGN KEY ("id_responsavel") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aula" ADD CONSTRAINT "aula_id_modulo_fkey" FOREIGN KEY ("id_modulo") REFERENCES "modulo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aula" ADD CONSTRAINT "aula_id_arquivo_fkey" FOREIGN KEY ("id_arquivo") REFERENCES "arquivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "aula" ADD CONSTRAINT "aula_id_responsavel_fkey" FOREIGN KEY ("id_responsavel") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teste" ADD CONSTRAINT "teste_id_modulo_fkey" FOREIGN KEY ("id_modulo") REFERENCES "modulo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teste" ADD CONSTRAINT "teste_id_responsavel_fkey" FOREIGN KEY ("id_responsavel") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questao" ADD CONSTRAINT "questao_id_responsavel_fkey" FOREIGN KEY ("id_responsavel") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questao" ADD CONSTRAINT "questao_id_alternativa_correta_fkey" FOREIGN KEY ("id_alternativa_correta") REFERENCES "alternativa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alternativa" ADD CONSTRAINT "alternativa_id_questao_fkey" FOREIGN KEY ("id_questao") REFERENCES "questao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alternativa" ADD CONSTRAINT "alternativa_id_responsavel_fkey" FOREIGN KEY ("id_responsavel") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teste_questao" ADD CONSTRAINT "teste_questao_id_teste_fkey" FOREIGN KEY ("id_teste") REFERENCES "teste"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teste_questao" ADD CONSTRAINT "teste_questao_id_questao_fkey" FOREIGN KEY ("id_questao") REFERENCES "questao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscricao" ADD CONSTRAINT "inscricao_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscricao" ADD CONSTRAINT "inscricao_id_curso_fkey" FOREIGN KEY ("id_curso") REFERENCES "curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;
