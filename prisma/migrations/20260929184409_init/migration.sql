-- CreateEnum
CREATE TYPE "EmployeeStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'COMMUNICATION_MANAGER', 'HR_MANAGER', 'MANAGER', 'EMPLOYEE');

-- CreateTable
CREATE TABLE "employee" (
    "id" UUID NOT NULL,
    "matricula" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "job_title" TEXT NOT NULL,
    "corporate_email" TEXT,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'ACTIVE',
    "cpf_hash" TEXT NOT NULL,
    "pin_hash" TEXT,
    "pin_set_at" TIMESTAMPTZ(3),
    "pin_version" INTEGER NOT NULL DEFAULT 0,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "roles" "Role"[] DEFAULT ARRAY['EMPLOYEE']::"Role"[],
    "session_version" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_attempt" (
    "id" BIGSERIAL NOT NULL,
    "ip" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "employee_matricula_key" ON "employee"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "employee_corporate_email_key" ON "employee"("corporate_email");

-- CreateIndex
CREATE UNIQUE INDEX "user_employee_id_key" ON "user"("employee_id");

-- CreateIndex
CREATE INDEX "auth_attempt_ip_created_at_idx" ON "auth_attempt"("ip", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_actor_id_created_at_idx" ON "audit_log"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_log_action_created_at_idx" ON "audit_log"("action", "created_at");

-- AddForeignKey
ALTER TABLE "user" ADD CONSTRAINT "user_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ===== Adicionado manualmente (Fase 2) =====

-- LGPD (§184): cpf_hash só aceita HMAC-SHA256 em hex. Impede gravar CPF em texto por engano.
ALTER TABLE "employee" ADD CONSTRAINT "employee_cpf_hash_is_hmac" CHECK ("cpf_hash" ~ '^[0-9a-f]{64}$');

-- PIN só como argon2id (RN-AUTH-007).
ALTER TABLE "employee" ADD CONSTRAINT "employee_pin_hash_is_argon2id" CHECK ("pin_hash" IS NULL OR "pin_hash" LIKE '$argon2id$%');

-- RN-AUD-001: trilha de auditoria imutável (somente INSERT).
CREATE FUNCTION "audit_log_block_changes"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_log é somente inserção (RN-AUD-001)';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "audit_log_no_update_delete"
  BEFORE UPDATE OR DELETE ON "audit_log"
  FOR EACH ROW EXECUTE FUNCTION "audit_log_block_changes"();

CREATE TRIGGER "audit_log_no_truncate"
  BEFORE TRUNCATE ON "audit_log"
  FOR EACH STATEMENT EXECUTE FUNCTION "audit_log_block_changes"();
