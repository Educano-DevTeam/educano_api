-- CreateEnum
CREATE TYPE "finalidade_codigo" AS ENUM ('validacao_conta', 'redefinicao_senha');

-- CreateEnum
CREATE TYPE "turma_inscricao" AS ENUM ('MANHA', 'TARDE', 'NOITE', 'EAD');

-- CreateEnum
CREATE TYPE "status_tentativa" AS ENUM ('EM_ANDAMENTO', 'FINALIZADA');

-- CreateEnum
CREATE TYPE "origem_recompensa" AS ENUM ('AULA', 'MODULO', 'ATIVIDADE', 'SIMULADO', 'COMPRA', 'AJUSTE');

-- CreateEnum
CREATE TYPE "efeito_item" AS ENUM ('BOOST_XP', 'ESCUDO_SEQUENCIA', 'DICA_EXTRA', 'TEMPO_EXTRA', 'REVIVER_TENTATIVA', 'COSMETICO');

-- CreateEnum
CREATE TYPE "status_ativacao" AS ENUM ('ATIVO', 'EXPIRADO', 'CONSUMIDO');

-- AlterTable
ALTER TABLE "alternativa" ADD COLUMN     "ordem" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "codigo_validacao" ADD COLUMN     "finalidade" "finalidade_codigo" NOT NULL DEFAULT 'validacao_conta',
ALTER COLUMN "expira_em" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes');

-- AlterTable
ALTER TABLE "inscricao" ADD COLUMN     "turma" "turma_inscricao" NOT NULL DEFAULT 'EAD';

-- AlterTable
ALTER TABLE "modulo" ADD COLUMN     "licao_titulo" VARCHAR(150),
ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "perfil" ADD COLUMN     "sequencia_dias" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ultima_atividade_em" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "questao" ADD COLUMN     "explicacao" TEXT,
ADD COLUMN     "materia" "categoria_curso",
ADD COLUMN     "tema" VARCHAR(150);

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN     "senha_atualizada_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "plano_conta" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(40) NOT NULL,
    "preco_centavos" INTEGER NOT NULL DEFAULT 0,
    "cor" VARCHAR(30) NOT NULL DEFAULT '',
    "icone" VARCHAR(40) NOT NULL DEFAULT '',
    "destaque" VARCHAR(40),
    "beneficios" TEXT[],
    "indisponiveis" TEXT[],
    "limite_simulados_mes" INTEGER,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "plano_conta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "progresso_aula" (
    "id_usuario" UUID NOT NULL,
    "id_aula" UUID NOT NULL,
    "concluido_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "progresso_aula_pkey" PRIMARY KEY ("id_usuario","id_aula")
);

-- CreateTable
CREATE TABLE "tentativa_teste" (
    "id" UUID NOT NULL,
    "id_teste" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "status" "status_tentativa" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "materias" "categoria_curso"[],
    "dificuldade" "nivel_dificuldade",
    "tempo_minutos" INTEGER NOT NULL,
    "iniciado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizado_em" TIMESTAMPTZ(3),
    "total" INTEGER NOT NULL,
    "acertos" INTEGER,
    "nota" INTEGER,
    "xp_ganho" INTEGER NOT NULL DEFAULT 0,
    "moedas_ganhas" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tentativa_teste_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resposta_tentativa" (
    "id_tentativa" UUID NOT NULL,
    "id_questao" UUID NOT NULL,
    "ordem" INTEGER NOT NULL,
    "id_alternativa" UUID,
    "respondida_em" TIMESTAMPTZ(3),
    "correta" BOOLEAN,
    "dica_usada" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "resposta_tentativa_pkey" PRIMARY KEY ("id_tentativa","id_questao")
);

-- CreateTable
CREATE TABLE "movimentacao_recompensa" (
    "id" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "origem" "origem_recompensa" NOT NULL,
    "referencia" VARCHAR(64),
    "xp" INTEGER NOT NULL DEFAULT 0,
    "moedas" INTEGER NOT NULL DEFAULT 0,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimentacao_recompensa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item" (
    "id" UUID NOT NULL,
    "nome" VARCHAR(80) NOT NULL,
    "descricao" TEXT NOT NULL DEFAULT '',
    "preco" INTEGER NOT NULL,
    "icone" VARCHAR(40) NOT NULL DEFAULT 'star',
    "cor" VARCHAR(30) NOT NULL DEFAULT '#425BC2',
    "categoria" VARCHAR(40) NOT NULL,
    "efeito" "efeito_item" NOT NULL,
    "valor_efeito" INTEGER NOT NULL DEFAULT 0,
    "duracao_minutos" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventario_item" (
    "id_usuario" UUID NOT NULL,
    "id_item" UUID NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "inventario_item_pkey" PRIMARY KEY ("id_usuario","id_item")
);

-- CreateTable
CREATE TABLE "ativacao_item" (
    "id" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "id_item" UUID NOT NULL,
    "status" "status_ativacao" NOT NULL DEFAULT 'ATIVO',
    "ativado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expira_em" TIMESTAMPTZ(3),

    CONSTRAINT "ativacao_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flashcard" (
    "id" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "titulo" VARCHAR(120) NOT NULL,
    "pergunta" TEXT NOT NULL,
    "resposta" TEXT NOT NULL,
    "repeticoes_mensais" INTEGER NOT NULL DEFAULT 4,
    "ultima_revisao_em" TIMESTAMPTZ(3),
    "proxima_revisao_em" TIMESTAMPTZ(3),
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "flashcard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "plano_conta_nome_key" ON "plano_conta"("nome");

-- CreateIndex
CREATE INDEX "tentativa_teste_id_usuario_iniciado_em_idx" ON "tentativa_teste"("id_usuario", "iniciado_em");

-- CreateIndex
CREATE INDEX "tentativa_teste_id_teste_idx" ON "tentativa_teste"("id_teste");

-- CreateIndex
CREATE INDEX "movimentacao_recompensa_id_usuario_criado_em_idx" ON "movimentacao_recompensa"("id_usuario", "criado_em");

-- CreateIndex
CREATE UNIQUE INDEX "item_nome_key" ON "item"("nome");

-- CreateIndex
CREATE INDEX "ativacao_item_id_usuario_status_idx" ON "ativacao_item"("id_usuario", "status");

-- CreateIndex
CREATE INDEX "ativacao_item_status_expira_em_idx" ON "ativacao_item"("status", "expira_em");

-- CreateIndex
CREATE INDEX "flashcard_id_usuario_idx" ON "flashcard"("id_usuario");

-- CreateIndex
CREATE INDEX "questao_materia_idx" ON "questao"("materia");

-- AddForeignKey
ALTER TABLE "perfil" ADD CONSTRAINT "perfil_plano_conta_fkey" FOREIGN KEY ("plano_conta") REFERENCES "plano_conta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progresso_aula" ADD CONSTRAINT "progresso_aula_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "progresso_aula" ADD CONSTRAINT "progresso_aula_id_aula_fkey" FOREIGN KEY ("id_aula") REFERENCES "aula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentativa_teste" ADD CONSTRAINT "tentativa_teste_id_teste_fkey" FOREIGN KEY ("id_teste") REFERENCES "teste"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tentativa_teste" ADD CONSTRAINT "tentativa_teste_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resposta_tentativa" ADD CONSTRAINT "resposta_tentativa_id_tentativa_fkey" FOREIGN KEY ("id_tentativa") REFERENCES "tentativa_teste"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resposta_tentativa" ADD CONSTRAINT "resposta_tentativa_id_questao_fkey" FOREIGN KEY ("id_questao") REFERENCES "questao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resposta_tentativa" ADD CONSTRAINT "resposta_tentativa_id_alternativa_fkey" FOREIGN KEY ("id_alternativa") REFERENCES "alternativa"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movimentacao_recompensa" ADD CONSTRAINT "movimentacao_recompensa_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_item" ADD CONSTRAINT "inventario_item_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventario_item" ADD CONSTRAINT "inventario_item_id_item_fkey" FOREIGN KEY ("id_item") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ativacao_item" ADD CONSTRAINT "ativacao_item_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ativacao_item" ADD CONSTRAINT "ativacao_item_id_item_fkey" FOREIGN KEY ("id_item") REFERENCES "item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flashcard" ADD CONSTRAINT "flashcard_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;
