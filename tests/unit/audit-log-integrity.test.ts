import { describe, expect, it, vi } from "vitest";
import { assertSafeMetadata, audit, type AuditEntry } from "@/server/audit/audit";
import { listAudit, exportAudit, type AuditFilter } from "@/server/audit/query";
import type { Actor } from "@/server/authz/can";
import type { PrismaClient } from "@/generated/prisma/client";

describe("Integridade da Trilha de Auditoria (RN-AUD-001..004, §19, §184)", () => {
  const adminActor: Actor = { id: "u-admin", roles: ["ADMIN"] };
  const employeeActor: Actor = { id: "u-emp", roles: ["EMPLOYEE"] };
  const hrActor: Actor = { id: "u-hr", roles: ["HR_MANAGER"] };

  describe("1. Gravação Estruturada de Ações Administrativas (audit)", () => {
    it("grava registro com ator, ação, entidade, ID da entidade, metadados e IP", async () => {
      const mockCreate = vi.fn().mockResolvedValue({});
      const mockClient = {
        auditLog: {
          create: mockCreate,
        },
      } as any;

      const entry: AuditEntry = {
        actorId: "usr-admin-1",
        action: "ROLE_CHANGED",
        entity: "user",
        entityId: "usr-target-2",
        metadata: { before: ["EMPLOYEE"], after: ["COMMUNICATION_MANAGER", "EMPLOYEE"] },
        ip: "200.180.10.5",
      };

      await audit(mockClient, entry);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          actorId: "usr-admin-1",
          action: "ROLE_CHANGED",
          entity: "user",
          entityId: "usr-target-2",
          metadata: { before: ["EMPLOYEE"], after: ["COMMUNICATION_MANAGER", "EMPLOYEE"] },
          ip: "200.180.10.5",
        },
      });
    });

    it("preenche valores nulos para campos opcionais ausentes", async () => {
      const mockCreate = vi.fn().mockResolvedValue({});
      const mockClient = {
        auditLog: {
          create: mockCreate,
        },
      } as any;

      const entry: AuditEntry = {
        actorId: null, // Sistema / anônimo (ex: tentativa de login falha)
        action: "LOGIN_FAILED",
        entity: "user",
      };

      await audit(mockClient, entry);

      expect(mockCreate).toHaveBeenCalledWith({
        data: {
          actorId: null,
          action: "LOGIN_FAILED",
          entity: "user",
          entityId: null,
          metadata: {},
          ip: null,
        },
      });
    });
  });

  describe("2. Proteção de Dados Sensíveis e Conformidade LGPD (§184)", () => {
    it("assertSafeMetadata aceita metadados operacionais e contadores", () => {
      expect(() =>
        assertSafeMetadata({
          total: 100,
          created: 15,
          updated: 2,
          reason: "inactive",
          source: "ad",
          version: 2,
        })
      ).not.toThrow();
    });

    it.each([
      "cpf",
      "CPF",
      "cpfHash",
      "cpf_hash",
      "pin",
      "PIN",
      "newPin",
      "password",
      "Password",
      "senha",
      "SENHA",
      "secret",
      "AUTH_SECRET",
      "token",
      "sessionToken",
    ])("rejeita terminantemente a chave sensível '%s' na auditoria", (key) => {
      expect(() => assertSafeMetadata({ [key]: "dado-sensivel" })).toThrow(/proibida/i);
    });

    it("audit() aborta a inserção no banco se houver tentativa de gravar dados sensíveis", async () => {
      const mockCreate = vi.fn();
      const mockClient = {
        auditLog: {
          create: mockCreate,
        },
      } as any;

      const badEntry: AuditEntry = {
        actorId: "usr-admin-1",
        action: "IMPORT_EMPLOYEES",
        entity: "employee",
        metadata: { cpf: "123.456.789-00", total: 1 },
      };

      await expect(audit(mockClient, badEntry)).rejects.toThrow(/proibida/i);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  describe("3. Controle de Acesso à Trilha de Auditoria (audit.read)", () => {
    const emptyFilter: AuditFilter = { action: undefined, entity: undefined, person: undefined };

    it("bloqueia EMPLOYEE de consultar a trilha de auditoria", async () => {
      const mockPrisma = {} as PrismaClient;
      await expect(listAudit(mockPrisma, employeeActor, emptyFilter)).rejects.toMatchObject({
        code: "ERR_FORBIDDEN",
      });
    });

    it("bloqueia HR_MANAGER de consultar a trilha de auditoria", async () => {
      const mockPrisma = {} as PrismaClient;
      await expect(listAudit(mockPrisma, hrActor, emptyFilter)).rejects.toMatchObject({
        code: "ERR_FORBIDDEN",
      });
    });

    it("bloqueia usuário anônimo de consultar a trilha de auditoria com ERR_UNAUTHORIZED", async () => {
      const mockPrisma = {} as PrismaClient;
      await expect(listAudit(mockPrisma, null, emptyFilter)).rejects.toMatchObject({
        code: "ERR_UNAUTHORIZED",
      });
    });

    it("bloqueia exportação de auditoria para colaboradores sem audit.read", async () => {
      const mockPrisma = {} as PrismaClient;
      await expect(exportAudit(mockPrisma, employeeActor, emptyFilter)).rejects.toMatchObject({
        code: "ERR_FORBIDDEN",
      });
    });

    it("permite consulta de auditoria para ADMIN", async () => {
      const mockFindMany = vi.fn().mockResolvedValue([
        {
          id: 101n,
          createdAt: new Date("2026-10-01T12:00:00Z"),
          action: "LOGIN",
          entity: "user",
          entityId: "u-1",
          actorId: "u-1",
          ip: "10.0.0.1",
          metadata: { method: "ad" },
        },
      ]);

      const mockPrisma = {
        auditLog: {
          findMany: mockFindMany,
        },
        user: {
          findMany: vi.fn().mockResolvedValue([{ id: "u-1", employee: { name: "Maria Silva" } }]),
        },
      } as unknown as PrismaClient;

      const result = await listAudit(mockPrisma, adminActor, emptyFilter);

      expect(result.rows.length).toBe(1);
      expect(result.rows[0]).toMatchObject({
        id: "101",
        action: "LOGIN",
        actionLabel: "Login",
        entity: "user",
        actor: "Maria Silva",
        ip: "10.0.0.1",
      });
    });
  });
});
