-- AlterTable
ALTER TABLE "employee" ADD COLUMN     "birth_day" SMALLINT,
ADD COLUMN     "birth_month" SMALLINT,
ADD COLUMN     "corporate_phone" TEXT;

-- CreateTable
CREATE TABLE "employee_responsibility" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "responsibility" TEXT NOT NULL,
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_responsibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "employee_responsibility_employee_id_idx" ON "employee_responsibility"("employee_id");

-- AddForeignKey
ALTER TABLE "employee_responsibility" ADD CONSTRAINT "employee_responsibility_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RN-BDAY-002: só dia e mês, em faixas válidas.
ALTER TABLE "employee" ADD CONSTRAINT "employee_birth_valid"
  CHECK (("birth_day" IS NULL AND "birth_month" IS NULL)
      OR ("birth_day" BETWEEN 1 AND 31 AND "birth_month" BETWEEN 1 AND 12));

-- RN-SRC-005: busca sem diferença de acentuação.
CREATE EXTENSION IF NOT EXISTS "unaccent";
