-- CreateEnum
CREATE TYPE "finalidade_codigo_validacao" AS ENUM ('cadastro', 'reset_senha');

-- AlterTable
ALTER TABLE "codigo_validacao" ADD COLUMN     "finalidade" "finalidade_codigo_validacao" NOT NULL DEFAULT 'cadastro',
ALTER COLUMN "expira_em" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes');
