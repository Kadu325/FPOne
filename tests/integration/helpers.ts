import { randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { hashCpf } from "@/server/auth/cpf";

export const PEPPER = "p".repeat(40);
export const AUTH_SECRET = "s".repeat(40);
/** CPFs de teste com dígitos verificadores válidos. */
export const CPF_A = "52998224725";
export const CPF_B = "11144477735";

export function testPrisma(): PrismaClient {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL não definida.");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

/** Matrícula única por teste: dispensa limpar tabelas (audit_log é somente inserção). */
export function uniqueMatricula(): string {
  return `T${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

export function uniqueIp(): string {
  const b = randomUUID().replace(/-/g, "");
  return `10.${parseInt(b.slice(0, 2), 16)}.${parseInt(b.slice(2, 4), 16)}.${parseInt(b.slice(4, 6), 16)}`;
}

export async function createEmployee(
  prisma: PrismaClient,
  opts: { cpf?: string; status?: "ACTIVE" | "INACTIVE"; roles?: Role[]; email?: string } = {},
) {
  return prisma.employee.create({
    data: {
      matricula: uniqueMatricula(),
      name: "Pessoa Teste",
      unit: "Sede",
      department: "TI",
      jobTitle: "Analista",
      corporateEmail: opts.email ?? null,
      status: opts.status ?? "ACTIVE",
      cpfHash: hashCpf(opts.cpf ?? CPF_A, PEPPER),
      user: { create: { roles: opts.roles ?? ["EMPLOYEE"] } },
    },
    include: { user: true },
  });
}
