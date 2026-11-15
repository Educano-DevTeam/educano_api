-- AlterTable
ALTER TABLE "questao" ADD COLUMN "tema" VARCHAR(150);

-- CreateIndex
CREATE INDEX "questao_tema_dificuldade_idx" ON "questao"("tema", "dificuldade");
