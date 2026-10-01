-- Login só com usuário de rede: colaborador pode ser criado no 1º login do AD (sem CPF).
-- Migration aditiva: nenhuma coluna ou dado é removido.
ALTER TABLE "employee" ALTER COLUMN "cpf_hash" DROP NOT NULL;
ALTER TABLE "employee" ADD COLUMN "ad_username" TEXT;
CREATE UNIQUE INDEX "employee_ad_username_key" ON "employee"("ad_username");
