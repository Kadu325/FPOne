import { describe, expect, it, vi, beforeEach } from "vitest";
import { BusinessError } from "@/lib/errors";
import { assertCan, can, type Actor } from "@/server/authz/can";
import { PERMISSIONS, ROLE_PERMISSIONS, type Permission } from "@/server/authz/permissions";
import { getCurrentUser, requireUser } from "@/server/auth/session";
import { loadSessionUser } from "@/server/auth/service";
import type { PrismaClient } from "@/generated/prisma/client";

// Mock next/navigation e auth para teste de requireUser e getCurrentUser
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/auth";

describe("1. Validação de Acessos e Usuários Anônimos (RN-AUTH-001, RN-CORE-001)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("usuário não autenticado (null ou undefined) é bloqueado de todas as permissões do sistema", () => {
    for (const permission of PERMISSIONS) {
      expect(can(null, permission)).toBe(false);
      expect(can(undefined, permission)).toBe(false);
    }
  });

  it("assertCan lança ERR_UNAUTHORIZED para chamadas anônimas (null ou undefined)", () => {
    for (const permission of PERMISSIONS) {
      expect(() => assertCan(null, permission)).toThrow(
        expect.objectContaining({ code: "ERR_UNAUTHORIZED" })
      );
      expect(() => assertCan(undefined, permission)).toThrow(
        expect.objectContaining({ code: "ERR_UNAUTHORIZED" })
      );
    }
  });

  it("getCurrentUser retorna null quando não há sessão ativa", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any);
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it("getCurrentUser retorna null quando sessão não possui user.id", async () => {
    vi.mocked(auth).mockResolvedValueOnce({ user: {} } as any);
    const user = await getCurrentUser();
    expect(user).toBeNull();
  });

  it("requireUser redireciona usuário anônimo para /login com código seguro", async () => {
    vi.mocked(auth).mockResolvedValueOnce(null as any);
    await expect(requireUser()).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("requireUser retorna CurrentUser quando há sessão válida", async () => {
    vi.mocked(auth).mockResolvedValueOnce({
      user: {
        id: "usr-123",
        name: "Carlos Colaborador",
        matricula: "FP1001",
        roles: ["EMPLOYEE"],
      },
    } as any);

    const user = await requireUser();
    expect(user).toEqual({
      id: "usr-123",
      name: "Carlos Colaborador",
      matricula: "FP1001",
      roles: ["EMPLOYEE"],
    });
  });
});

describe("2. Matriz Estrita de Permissões RBAC (can.ts e permissions.ts)", () => {
  const employee: Actor = { id: "u-emp", roles: ["EMPLOYEE"] };
  const manager: Actor = { id: "u-mgr", roles: ["MANAGER"] };
  const hrManager: Actor = { id: "u-hr", roles: ["HR_MANAGER"] };
  const commManager: Actor = { id: "u-comm", roles: ["COMMUNICATION_MANAGER"] };
  const admin: Actor = { id: "u-admin", roles: ["ADMIN"] };

  describe("Perfil EMPLOYEE (Colaborador comum)", () => {
    it("possui apenas a permissão employee.read", () => {
      expect(can(employee, "employee.read")).toBe(true);
      expect(ROLE_PERMISSIONS.EMPLOYEE).toEqual(["employee.read"]);
    });

    it("é estritamente bloqueado de acessar o módulo administrativo", () => {
      expect(can(employee, "admin.access")).toBe(false);
      expect(() => assertCan(employee, "admin.access")).toThrow(
        expect.objectContaining({ code: "ERR_FORBIDDEN" })
      );
    });

    it("é bloqueado de todas as ações de gestão de comunicados e publicações", () => {
      const pubActions: Permission[] = [
        "publication.create",
        "publication.edit",
        "publication.publish",
        "publication.archive",
        "category.manage",
      ];
      for (const p of pubActions) {
        expect(can(employee, p)).toBe(false);
        expect(() => assertCan(employee, p)).toThrow(
          expect.objectContaining({ code: "ERR_FORBIDDEN" })
        );
      }
    });

    it("é bloqueado de gerenciar documentos, links, eventos e responsabilidades", () => {
      const contentActions: Permission[] = [
        "document.manage",
        "link.manage",
        "event.manage",
        "responsibility.manage",
      ];
      for (const p of contentActions) {
        expect(can(employee, p)).toBe(false);
        expect(() => assertCan(employee, p)).toThrow(
          expect.objectContaining({ code: "ERR_FORBIDDEN" })
        );
      }
    });

    it("é bloqueado de operações de RH e gestão de colaboradores", () => {
      const hrActions: Permission[] = [
        "employee.import",
        "employee.update",
        "user.deactivate",
        "user.manage_roles",
      ];
      for (const p of hrActions) {
        expect(can(employee, p)).toBe(false);
        expect(() => assertCan(employee, p)).toThrow(
          expect.objectContaining({ code: "ERR_FORBIDDEN" })
        );
      }
    });

    it("é bloqueado de visualizar a trilha de auditoria e métricas de analytics", () => {
      expect(can(employee, "audit.read")).toBe(false);
      expect(can(employee, "analytics.read")).toBe(false);
      expect(() => assertCan(employee, "audit.read")).toThrow(
        expect.objectContaining({ code: "ERR_FORBIDDEN" })
      );
      expect(() => assertCan(employee, "analytics.read")).toThrow(
        expect.objectContaining({ code: "ERR_FORBIDDEN" })
      );
    });
  });

  describe("Perfil HR_MANAGER (Gestor de RH)", () => {
    it("possui acesso ao admin e permissões exclusivas de RH", () => {
      const expectedAllowed: Permission[] = [
        "admin.access",
        "employee.import",
        "employee.read",
        "user.deactivate",
        "employee.update",
      ];
      for (const p of expectedAllowed) {
        expect(can(hrManager, p)).toBe(true);
      }
      expect(ROLE_PERMISSIONS.HR_MANAGER.length).toBe(expectedAllowed.length);
    });

    it("NÃO possui permissão para alterar papéis de usuários (RN-RBAC-004)", () => {
      expect(can(hrManager, "user.manage_roles")).toBe(false);
      expect(() => assertCan(hrManager, "user.manage_roles")).toThrow(
        expect.objectContaining({ code: "ERR_FORBIDDEN" })
      );
    });

    it("NÃO possui acesso à auditoria nem a publicações/conteúdo", () => {
      const forbidden: Permission[] = [
        "audit.read",
        "publication.create",
        "publication.edit",
        "publication.publish",
        "publication.archive",
        "category.manage",
        "analytics.read",
        "responsibility.manage",
        "link.manage",
        "event.manage",
        "document.manage",
      ];
      for (const p of forbidden) {
        expect(can(hrManager, p)).toBe(false);
        expect(() => assertCan(hrManager, p)).toThrow(
          expect.objectContaining({ code: "ERR_FORBIDDEN" })
        );
      }
    });
  });

  describe("Perfil COMMUNICATION_MANAGER (Gestor de Comunicação)", () => {
    it("possui acesso ao admin e gestão completa de comunicados e conteúdos", () => {
      const expectedAllowed: Permission[] = [
        "admin.access",
        "employee.read",
        "publication.create",
        "publication.edit",
        "publication.publish",
        "publication.archive",
        "category.manage",
        "analytics.read",
        "responsibility.manage",
        "link.manage",
        "event.manage",
        "document.manage",
      ];
      for (const p of expectedAllowed) {
        expect(can(commManager, p)).toBe(true);
      }
      expect(ROLE_PERMISSIONS.COMMUNICATION_MANAGER.length).toBe(expectedAllowed.length);
    });

    it("NÃO possui permissões administrativas de RH nem auditoria", () => {
      const forbidden: Permission[] = [
        "employee.import",
        "employee.update",
        "user.deactivate",
        "user.manage_roles",
        "audit.read",
      ];
      for (const p of forbidden) {
        expect(can(commManager, p)).toBe(false);
        expect(() => assertCan(commManager, p)).toThrow(
          expect.objectContaining({ code: "ERR_FORBIDDEN" })
        );
      }
    });
  });

  describe("Perfil MANAGER (Gestor departamental)", () => {
    it("possui apenas consulta a colaboradores", () => {
      expect(can(manager, "employee.read")).toBe(true);
      expect(can(manager, "admin.access")).toBe(false);
      expect(ROLE_PERMISSIONS.MANAGER).toEqual(["employee.read"]);
    });
  });

  describe("Perfil ADMIN (Administrador Global)", () => {
    it("possui todas as 17 permissões do sistema sem exceção", () => {
      expect(PERMISSIONS.length).toBe(17);
      for (const p of PERMISSIONS) {
        expect(can(admin, p)).toBe(true);
        expect(() => assertCan(admin, p)).not.toThrow();
      }
      expect(ROLE_PERMISSIONS.ADMIN).toBe(PERMISSIONS);
    });
  });

  describe("Composição de múltiplos papéis", () => {
    it("usuário com papéis de RH e Comunicação acumula ambos mas não vira ADMIN", () => {
      const dualActor: Actor = { id: "u-dual", roles: ["HR_MANAGER", "COMMUNICATION_MANAGER"] };
      expect(can(dualActor, "employee.import")).toBe(true);
      expect(can(dualActor, "publication.create")).toBe(true);
      expect(can(dualActor, "document.manage")).toBe(true);
      expect(can(dualActor, "user.manage_roles")).toBe(false);
      expect(can(dualActor, "audit.read")).toBe(false);
    });
  });
});

describe("3. Invalidação de Sessão em Tempo Real (loadSessionUser)", () => {
  it("encerra sessão quando sessionVersion do banco diverge da sessão (logout forçado)", async () => {
    const mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "u-1",
          sessionVersion: 2, // Banco foi incrementado (ex.: troca de senha ou inativação)
          employee: {
            id: "e-1",
            name: "Lucas",
            matricula: "FP1002",
            status: "ACTIVE",
          },
          roles: ["EMPLOYEE"],
        }),
      },
    } as unknown as PrismaClient;

    // Sessão do cookie ainda está na versão 1
    const result = await loadSessionUser(mockPrisma, "u-1", 1);
    expect(result).toBeNull();
  });

  it("encerra sessão imediatamente quando colaborador é inativado no banco", async () => {
    const mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "u-1",
          sessionVersion: 1,
          employee: {
            id: "e-1",
            name: "Lucas",
            matricula: "FP1002",
            status: "INACTIVE", // Inativado pelo RH
          },
          roles: ["EMPLOYEE"],
        }),
      },
    } as unknown as PrismaClient;

    const result = await loadSessionUser(mockPrisma, "u-1", 1);
    expect(result).toBeNull();
  });

  it("permite sessão quando usuário existe, está ativo e com sessionVersion idêntica", async () => {
    const mockPrisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "u-1",
          sessionVersion: 1,
          roles: ["EMPLOYEE", "COMMUNICATION_MANAGER"],
          employee: {
            id: "e-1",
            name: "Lucas Silva",
            matricula: "FP1002",
            status: "ACTIVE",
          },
        }),
      },
    } as unknown as PrismaClient;

    const result = await loadSessionUser(mockPrisma, "u-1", 1);
    expect(result).toMatchObject({
      id: "u-1",
      employeeId: "e-1",
      name: "Lucas Silva",
      matricula: "FP1002",
      roles: ["EMPLOYEE", "COMMUNICATION_MANAGER"],
      sessionVersion: 1,
    });
  });
});
