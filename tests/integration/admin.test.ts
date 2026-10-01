import { afterAll, describe, expect, it } from "vitest";
import { adminSetEmployeeActive, adminSetUserRoles, bootstrapFirstAdmin } from "@/server/admin/users";
import { audit } from "@/server/audit/audit";
import { loadSessionUser } from "@/server/auth/service";
import { parseEmployeesCsv } from "@/server/employees/csv";
import { importEmployees } from "@/server/employees/import";
import { CPF_A, PEPPER, createEmployee, testPrisma, uniqueMatricula } from "./helpers";

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());

const HEADER = "matricula;nome;unidade;departamento;cargo;cpf;email_corporativo;status";

async function hrActor() {
  const e = await createEmployee(prisma, { roles: ["HR_MANAGER"] });
  return { id: e.user?.id ?? "", roles: e.user?.roles ?? [] };
}

describe("carga CSV (§184)", () => {
  it("EMPLOYEE não pode importar", async () => {
    const e = await createEmployee(prisma);
    const actor = { id: e.user?.id ?? "", roles: e.user?.roles ?? [] };
    await expect(importEmployees(prisma, actor, { rows: [], errors: [] }, PEPPER, null)).rejects.toMatchObject({ code: "ERR_FORBIDDEN" });
  });

  it("cria colaboradores com perfil EMPLOYEE, guarda só o HMAC e audita só totais", async () => {
    const actor = await hrActor();
    const m1 = uniqueMatricula();
    const m2 = uniqueMatricula();
    const email = `${m2.toLowerCase()}@fazendaprogresso.com`;
    const csv = `${HEADER}\n${m1};Ana;Sede;RH;Analista;529.982.247-25;;ativo\n${m2};Bruno;Sede;TI;Dev;111.444.777-35;${email};ativo`;
    const r = await importEmployees(prisma, actor, parseEmployeesCsv(csv), PEPPER, "10.0.0.1");
    expect(r).toMatchObject({ ok: true, summary: { total: 2, created: 2, updated: 0 } });

    const ana = await prisma.employee.findUniqueOrThrow({ where: { matricula: m1 }, include: { user: true } });
    expect(ana.user?.roles).toEqual(["EMPLOYEE"]);
    expect(ana.cpfHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(ana)).not.toContain(CPF_A);

    const log = await prisma.auditLog.findFirstOrThrow({ where: { actorId: actor.id, action: "IMPORT_EMPLOYEES" } });
    expect(log.metadata).toMatchObject({ total: 2, created: 2 });
    expect(JSON.stringify({ ...log, id: String(log.id) })).not.toMatch(/52998224725|Ana|Bruno/);
  });

  it("é tudo ou nada: uma linha inválida impede a carga inteira", async () => {
    const actor = await hrActor();
    const ok = uniqueMatricula();
    const csv = `${HEADER}\n${ok};Ana;Sede;RH;Analista;52998224725;;ativo\n${uniqueMatricula()};Bia;Sede;RH;Analista;12345678900;;ativo`;
    const r = await importEmployees(prisma, actor, parseEmployeesCsv(csv), PEPPER, null);
    expect(r.ok).toBe(false);
    expect(await prisma.employee.findUnique({ where: { matricula: ok } })).toBeNull();
  });

  it("inativar pelo CSV encerra sessões; ausentes são listados e continuam ativos", async () => {
    const actor = await hrActor();
    const stays = await createEmployee(prisma);
    const leaves = await createEmployee(prisma);
    const csv = `${HEADER}\n${leaves.matricula};Pessoa;Sede;TI;Analista;52998224725;;inativo`;
    const r = await importEmployees(prisma, actor, parseEmployeesCsv(csv), PEPPER, null);
    if (!r.ok) throw new Error("import falhou");
    expect(r.summary.deactivated).toBe(1);
    expect(r.summary.absent.map((a) => a.matricula)).toContain(stays.matricula);
    expect(await loadSessionUser(prisma, leaves.user?.id ?? "", 0)).toBeNull();
    expect((await prisma.employee.findUniqueOrThrow({ where: { id: stays.id } })).status).toBe("ACTIVE");
  });

  it("recusa e-mail que pertence a matrícula fora do arquivo", async () => {
    const actor = await hrActor();
    const email = `dono-${Date.now()}@fazendaprogresso.com`;
    await createEmployee(prisma, { email });
    const csv = `${HEADER}\n${uniqueMatricula()};Outra;Sede;TI;Dev;52998224725;${email};ativo`;
    const r = await importEmployees(prisma, actor, parseEmployeesCsv(csv), PEPPER, null);
    expect(r).toMatchObject({ ok: false, errors: [{ field: "email_corporativo" }] });
  });
});

describe("administração de acesso", () => {
  it("EMPLOYEE não inativa", async () => {
    const e = await createEmployee(prisma);
    const actor = { id: e.user?.id ?? "", roles: e.user?.roles ?? [] };
    await expect(adminSetEmployeeActive(prisma, actor, e.id, false, null)).rejects.toMatchObject({ code: "ERR_FORBIDDEN" });
  });

  it("inativar encerra sessões (RN-AUTH-004)", async () => {
    const actor = await hrActor();
    const e = await createEmployee(prisma);
    await adminSetEmployeeActive(prisma, actor, e.id, false, null);
    expect(await loadSessionUser(prisma, e.user?.id ?? "", 0)).toBeNull();
  });

  it("bootstrap do primeiro ADMIN roda uma única vez", async () => {
    const first = await createEmployee(prisma);
    const second = await createEmployee(prisma);
    await bootstrapFirstAdmin(prisma, first.matricula);
    const user = await prisma.user.findUniqueOrThrow({ where: { id: first.user?.id } });
    expect(user.roles).toContain("ADMIN");
    await expect(bootstrapFirstAdmin(prisma, second.matricula)).rejects.toMatchObject({ code: "ERR_ADMIN_ALREADY_EXISTS" });
    expect(await prisma.auditLog.count({ where: { action: "ADMIN_BOOTSTRAP" } })).toBe(1);
  });

  it("perfis: só com user.manage_roles, nunca os próprios, auditado com antes/depois (RN-RBAC-004/005)", async () => {
    const adminEmp = await createEmployee(prisma, { roles: ["EMPLOYEE", "ADMIN"] });
    const admin = { id: adminEmp.user?.id ?? "", roles: adminEmp.user?.roles ?? [] };
    const hr = await hrActor();
    const target = await createEmployee(prisma);
    const targetId = target.user?.id ?? "";

    await expect(adminSetUserRoles(prisma, hr, targetId, ["COMMUNICATION_MANAGER"], null)).rejects.toMatchObject({ code: "ERR_FORBIDDEN" });
    await expect(adminSetUserRoles(prisma, admin, admin.id, [], null)).rejects.toMatchObject({ code: "ERR_FORBIDDEN" });

    await adminSetUserRoles(prisma, admin, targetId, ["COMMUNICATION_MANAGER"], null);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: targetId } })).roles.sort()).toEqual(["COMMUNICATION_MANAGER", "EMPLOYEE"]);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: targetId, action: "ROLE_CHANGED" } });
    expect(log.metadata).toEqual({ before: ["EMPLOYEE"], after: ["COMMUNICATION_MANAGER", "EMPLOYEE"] });
  });
});

describe("trilha de auditoria (RN-AUD-001)", () => {
  it("UPDATE e DELETE são bloqueados pelo banco", async () => {
    await audit(prisma, { actorId: null, action: "LOGOUT", entity: "user" });
    const row = await prisma.auditLog.findFirstOrThrow({ orderBy: { id: "desc" } });
    await expect(prisma.auditLog.update({ where: { id: row.id }, data: { action: "X" } })).rejects.toThrow();
    await expect(prisma.auditLog.delete({ where: { id: row.id } })).rejects.toThrow();
  });

  it("nenhum registro de auditoria contém CPF", async () => {
    const all = await prisma.auditLog.findMany();
    expect(JSON.stringify(all, (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v))).not.toMatch(/52998224725|11144477735/);
  });

  it("banco recusa cpf_hash que não seja HMAC", async () => {
    await expect(
      prisma.employee.create({
        data: { matricula: uniqueMatricula(), name: "X", unit: "X", department: "X", jobTitle: "X", cpfHash: "52998224725" },
      }),
    ).rejects.toThrow();
  });
});
