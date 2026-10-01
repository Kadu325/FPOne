import { describe, expect, it } from "vitest";
import { initials, primaryRoleLabel } from "./shell-profile";

describe("perfil do shell", () => {
  it("iniciais do primeiro e do último nome", () => {
    expect(initials("Marcos Fontoura")).toBe("MF");
    expect(initials("  ana  maria souza ")).toBe("AS");
    expect(initials("Joana")).toBe("J");
    expect(initials("")).toBe("?");
  });

  it("perfil principal é o mais amplo", () => {
    expect(primaryRoleLabel(["EMPLOYEE", "ADMIN"])).toBe("Administrador");
    expect(primaryRoleLabel(["EMPLOYEE", "HR_MANAGER"])).toBe("Gestor de RH");
    expect(primaryRoleLabel(["EMPLOYEE"])).toBe("Colaborador");
    expect(primaryRoleLabel([])).toBe("Colaborador");
  });
});
