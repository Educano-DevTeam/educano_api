-- AlterTable
ALTER TABLE "codigo_validacao" ALTER COLUMN "expira_em" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes');

-- AlterTable
ALTER TABLE "curso" ADD COLUMN     "icone_capa" VARCHAR(30);

-- DropEnum
DROP TYPE "tipo_capa_curso";
