/**
 * Bootstrap do primeiro ADMIN (decisão de 29/09/2026).
 * Uso: docker compose run --rm tools npm run admin:bootstrap -- --matricula 000123
 * Roda uma única vez: recusa se já existir algum ADMIN. Auditado (ADMIN_BOOTSTRAP, ROLE_CHANGED).
 */
import { parseArgs } from "node:util";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { bootstrapFirstAdmin } from "../src/server/admin/users";
import { BusinessError } from "../src/lib/errors";

const { values } = parseArgs({ options: { matricula: { type: "string" } } });
const matricula = values.matricula?.trim();
if (!matricula) {
  console.error("Informe --matricula <número>.");
  process.exit(2);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida.");
  process.exit(2);
}

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
try {
  await bootstrapFirstAdmin(prisma, matricula);
  console.log(`Perfil ADMIN atribuído à matrícula ${matricula}.`);
} catch (e) {
  console.error(e instanceof BusinessError ? (e.message === e.code ? e.code : e.message) : "Falha inesperada no bootstrap.");
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
