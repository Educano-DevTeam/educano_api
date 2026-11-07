-- AlterTable
ALTER TABLE "codigo_validacao" ALTER COLUMN "expira_em" SET DEFAULT (CURRENT_TIMESTAMP + INTERVAL '10 minutes');

-- CreateTable
CREATE TABLE "curso_professor" (
    "id" UUID NOT NULL,
    "id_professor" UUID NOT NULL,
    "id_curso" UUID NOT NULL,
    "id_responsavel_vinculo" UUID NOT NULL,
    "criado_em" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "curso_professor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "curso_professor_id_curso_idx" ON "curso_professor"("id_curso");

-- CreateIndex
CREATE INDEX "curso_professor_id_professor_idx" ON "curso_professor"("id_professor");

-- CreateIndex
CREATE INDEX "curso_professor_id_responsavel_vinculo_idx" ON "curso_professor"("id_responsavel_vinculo");

-- CreateIndex
CREATE UNIQUE INDEX "curso_professor_id_professor_id_curso_key" ON "curso_professor"("id_professor", "id_curso");

-- AddForeignKey
ALTER TABLE "curso_professor" ADD CONSTRAINT "curso_professor_id_professor_fkey" FOREIGN KEY ("id_professor") REFERENCES "usuario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso_professor" ADD CONSTRAINT "curso_professor_id_curso_fkey" FOREIGN KEY ("id_curso") REFERENCES "curso"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curso_professor" ADD CONSTRAINT "curso_professor_id_responsavel_vinculo_fkey" FOREIGN KEY ("id_responsavel_vinculo") REFERENCES "usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
