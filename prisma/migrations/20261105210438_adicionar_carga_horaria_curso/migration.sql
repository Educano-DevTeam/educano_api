-- AlterTable
ALTER TABLE "codigo_validacao" ALTER COLUMN "expira_em" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes');

-- AlterTable
ALTER TABLE "curso" ADD COLUMN     "carga_horaria" INTEGER;
