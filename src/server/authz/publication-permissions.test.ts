import { describe, expect, it } from "vitest";
import type { Role } from "@/generated/prisma/enums";
import { can } from "./can";

const as = (...roles: Role[]) => ({ id: "u", roles });
const CONTENT = ["publication.create", "publication.edit", "publication.publish", "publication.archive", "category.manage", "analytics.read"] as const;

describe("permissões de publicação (§70, §170)", () => {
  it("Comunicação cria, edita, publica, arquiva, gere categorias e vê métricas", () => {
    for (const p of CONTENT) expect(can(as("COMMUNICATION_MANAGER"), p)).toBe(true);
  });

  it("colaborador, gestor e RH não administram publicações", () => {
    for (const role of ["EMPLOYEE", "MANAGER", "HR_MANAGER"] as const) {
      for (const p of CONTENT) expect(can(as(role), p)).toBe(false);
    }
  });
});

describe("permissões de Pessoas (§103, §170)", () => {
  it("RH edita contato; Comunicação gere responsabilidades; colaborador só lê", () => {
    expect(can(as("HR_MANAGER"), "employee.update")).toBe(true);
    expect(can(as("HR_MANAGER"), "responsibility.manage")).toBe(false);
    expect(can(as("COMMUNICATION_MANAGER"), "responsibility.manage")).toBe(true);
    expect(can(as("COMMUNICATION_MANAGER"), "employee.update")).toBe(false);
    for (const p of ["employee.update", "responsibility.manage"] as const) expect(can(as("EMPLOYEE"), p)).toBe(false);
    expect(can(as("EMPLOYEE"), "employee.read")).toBe(true);
  });
});
