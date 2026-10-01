import { describe, expect, it } from "vitest";
import { BusinessError } from "@/lib/errors";
import { assertCan, can } from "./can";
import { PERMISSIONS } from "./permissions";

const employee = { id: "u1", roles: ["EMPLOYEE"] as const };
const hr = { id: "u2", roles: ["HR_MANAGER"] as const };
const admin = { id: "u3", roles: ["ADMIN"] as const };

describe("can (RN-CORE-001, RN-RBAC-001)", () => {
  it("sem ator não pode nada", () => {
    expect(can(null, "employee.read")).toBe(false);
  });

  it("EMPLOYEE não acessa o admin nem importa CSV", () => {
    expect(can(employee, "admin.access")).toBe(false);
    expect(can(employee, "employee.import")).toBe(false);
    expect(can(employee, "user.deactivate")).toBe(false);
  });

  it("HR_MANAGER importa e inativa, mas não troca perfis nem lê auditoria", () => {
    expect(can(hr, "employee.import")).toBe(true);
    expect(can(hr, "user.deactivate")).toBe(true);
    expect(can(hr, "user.manage_roles")).toBe(false);
    expect(can(hr, "audit.read")).toBe(false);
  });

  it("ADMIN tem todas as permissões", () => {
    for (const p of PERMISSIONS) expect(can(admin, p)).toBe(true);
  });

  it("múltiplos perfis somam permissões", () => {
    expect(can({ id: "u4", roles: ["EMPLOYEE", "HR_MANAGER"] }, "employee.import")).toBe(true);
  });

  it("assertCan distingue não autenticado de proibido", () => {
    expect(() => assertCan(null, "admin.access")).toThrow(expect.objectContaining({ code: "ERR_UNAUTHORIZED" }));
    expect(() => assertCan(employee, "admin.access")).toThrow(BusinessError);
    expect(() => assertCan(employee, "admin.access")).toThrow(expect.objectContaining({ code: "ERR_FORBIDDEN" }));
  });
});
