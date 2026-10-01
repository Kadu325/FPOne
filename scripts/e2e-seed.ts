/**
 * Prepara colaboradores para os testes E2E no ambiente LOCAL.
 * Uso: docker compose run --rm -e E2E_ALLOW_SEED=true tools npx tsx scripts/e2e-seed.ts
 * Recusa rodar sem E2E_ALLOW_SEED=true. Usa só matrículas com prefixo E2E.
 * O login é via AD; os E2E usam sessões emitidas no tests/e2e/global-setup.ts.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import type { Role } from "../src/generated/prisma/enums";
import { hashCpf } from "../src/server/auth/cpf";

if (process.env.E2E_ALLOW_SEED !== "true") {
  console.error("Defina E2E_ALLOW_SEED=true para confirmar que este é um ambiente local de teste.");
  process.exit(2);
}
const url = process.env.DATABASE_URL;
const pepper = process.env.CPF_PEPPER;
if (!url || !pepper) {
  console.error("DATABASE_URL e CPF_PEPPER são obrigatórias.");
  process.exit(2);
}

/** CPFs de teste com dígitos verificadores válidos (a coluna cpf_hash ainda é obrigatória). */
const people: { matricula: string; name: string; cpf: string; roles: Role[]; unit?: string }[] = [
  { matricula: "E2E002", name: "Colaborador Teste", cpf: "11144477735", roles: ["EMPLOYEE"] },
  { matricula: "E2E003", name: "Gestora RH Teste", cpf: "52998224725", roles: ["EMPLOYEE", "HR_MANAGER"] },
  { matricula: "E2E004", name: "Comunicação Teste", cpf: "11144477735", roles: ["EMPLOYEE", "COMMUNICATION_MANAGER"] },
  // Outra unidade: não pode ver publicações segmentadas para "Sede" (RN-CORE-002).
  { matricula: "E2E005", name: "Campo Teste", cpf: "52998224725", roles: ["EMPLOYEE"], unit: "Fazenda Norte" },
  // Único perfil com audit.read (auditoria, Fase 7).
  { matricula: "E2E006", name: "Admin Teste", cpf: "11144477735", roles: ["EMPLOYEE", "ADMIN"] },
];

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
try {
  for (const p of people) {
    const data = {
      name: p.name,
      unit: p.unit ?? "Sede",
      department: "Testes",
      jobTitle: "E2E",
      status: "ACTIVE" as const,
      corporateEmail: `${p.matricula.toLowerCase()}@e2e.invalid`,
      cpfHash: hashCpf(p.cpf, pepper),
    };
    const e = await prisma.employee.upsert({ where: { matricula: p.matricula }, create: { matricula: p.matricula, ...data }, update: data });
    await prisma.user.upsert({ where: { employeeId: e.id }, create: { employeeId: e.id, roles: p.roles }, update: { roles: p.roles } });
  }
  console.log(`E2E: ${people.length} colaboradores de teste prontos.`);
} finally {
  await prisma.$disconnect();
}
