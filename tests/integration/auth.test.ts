import { afterAll, describe, expect, it } from "vitest";
import { loadSessionUser, resolveAdLogin } from "@/server/auth/service";
import { createEmployee, testPrisma } from "./helpers";

const prisma = testPrisma();
afterAll(() => prisma.$disconnect());

describe("sessão (§182, RN-AUTH-003/004)", () => {
  it("válida com a mesma versão; inválida com versão antiga ou usuário inativo", async () => {
    const e = await createEmployee(prisma);
    const userId = e.user?.id ?? "";
    expect(await loadSessionUser(prisma, userId, 0)).toMatchObject({ id: userId, matricula: e.matricula });
    expect(await loadSessionUser(prisma, userId, 1)).toBeNull();
    await prisma.employee.update({ where: { id: e.id }, data: { status: "INACTIVE" } });
    expect(await loadSessionUser(prisma, userId, 0)).toBeNull();
  });
});

describe("vínculo da conta AD com o colaborador", () => {
  it("conta de rede sem colaborador importado é criada no 1º login, com perfil EMPLOYEE", async () => {
    const username = `Novo.${Date.now()}`;
    const r = await resolveAdLogin({ prisma, ip: null }, { username, emails: [null], name: "Novo Colaborador", department: "TI", title: null });
    expect(r.ok).toBe(true);
    const e = await prisma.employee.findUnique({ where: { adUsername: username.toLowerCase() }, include: { user: true } });
    expect(e).toMatchObject({ name: "Novo Colaborador", department: "TI", cpfHash: null, corporateEmail: null, user: { roles: ["EMPLOYEE"] } });
    expect(await prisma.auditLog.count({ where: { entityId: e?.user?.id, action: "USER_PROVISIONED" } })).toBe(1);
    // 2º login reutiliza o mesmo registro.
    const again = await resolveAdLogin({ prisma, ip: null }, { username: username.toUpperCase(), emails: [] });
    expect(again).toMatchObject({ ok: true, value: { employeeId: e?.id } });
  });

  it("entra pelo mail ou pelo UPN, sem diferenciar maiúsculas, e audita LOGIN", async () => {
    const email = `${Date.now()}@fazendaprogresso.com`;
    const e = await createEmployee(prisma, { email });
    const r = await resolveAdLogin({ prisma, ip: null }, { username: `x-${Date.now()}`, emails: [null, email.toUpperCase()] });
    expect(r).toMatchObject({ ok: true, value: { employeeId: e.id } });
    expect(await prisma.auditLog.count({ where: { entityId: e.user?.id, action: "LOGIN" } })).toBe(1);
  });

  it("colaborador inativo não entra", async () => {
    const email = `inativo-${Date.now()}@fazendaprogresso.com`;
    await createEmployee(prisma, { email, status: "INACTIVE" });
    expect(await resolveAdLogin({ prisma, ip: null }, { username: `inativo-${Date.now()}`, emails: [email] })).toEqual({ ok: false, reason: "inactive" });
  });
});
