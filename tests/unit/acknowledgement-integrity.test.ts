import { describe, expect, it, vi } from "vitest";
import { BusinessError } from "@/lib/errors";
import { acknowledge } from "@/server/publications/feed";
import { hasValidAcknowledgement } from "@/server/publications/rules";
import type { AudienceSubject } from "@/server/authz/audience";
import type { PrismaClient } from "@/generated/prisma/client";

describe("Integridade da Confirmação de Leitura ('Li e estou ciente')", () => {
  const subject: AudienceSubject = {
    userId: "usr-reader-1",
    unit: "Fazenda Progresso",
    department: "Operações",
    groupIds: [],
  };

  const pubId = "pub-norma-seguranca-001";
  const now = new Date("2026-10-01T10:00:00.000Z");
  const testIp = "192.168.1.100";

  describe("1. Regra hasValidAcknowledgement (Validação de Versão)", () => {
    it("confirmação válida apenas quando a versão confirmada bate exatamente com a versão atual da publicação", () => {
      expect(hasValidAcknowledgement({ acknowledgedVersion: 1 }, 1)).toBe(true);
      expect(hasValidAcknowledgement({ acknowledgedVersion: 2 }, 2)).toBe(true);
    });

    it("publicação alterada materialmente (versão superior) invalida confirmação anterior", () => {
      // Usuário confirmou v1, mas publicação foi editada para v2 (§10, RN-ACK-003)
      expect(hasValidAcknowledgement({ acknowledgedVersion: 1 }, 2)).toBe(false);
      expect(hasValidAcknowledgement({ acknowledgedVersion: 2 }, 3)).toBe(false);
    });

    it("sem confirmação prévia (null ou undefined), retorna falso", () => {
      expect(hasValidAcknowledgement({ acknowledgedVersion: null }, 1)).toBe(false);
      expect(hasValidAcknowledgement(undefined, 1)).toBe(false);
      expect(hasValidAcknowledgement(null, 1)).toBe(false);
    });
  });

  describe("2. Fluxo da Ação acknowledge() e Prevenção de Duplicidades", () => {
    it("primeira confirmação registra data/hora, versão da publicação e grava auditoria", async () => {
      const mockUpsert = vi.fn().mockResolvedValue({});
      const mockAuditCreate = vi.fn().mockResolvedValue({});

      const txMock = {
        publication: {
          findFirst: vi.fn().mockResolvedValue({
            id: pubId,
            version: 1,
            requiresAcknowledgement: true,
            reads: [], // Ainda sem leitura confirmada
          }),
        },
        publicationRead: {
          upsert: mockUpsert,
        },
        auditLog: {
          create: mockAuditCreate,
        },
      };

      const prismaMock = {
        $transaction: vi.fn(async (cb) => cb(txMock)),
      } as unknown as PrismaClient;

      const result = await acknowledge(prismaMock, subject, pubId, now, testIp);

      expect(result).toEqual({ alreadyAcknowledged: false });

      // Garante upsert com chave única [publicationId, userId], timestamp e versão exatos
      expect(mockUpsert).toHaveBeenCalledTimes(1);
      expect(mockUpsert).toHaveBeenCalledWith({
        where: {
          publicationId_userId: { publicationId: pubId, userId: subject.userId },
        },
        create: {
          publicationId: pubId,
          userId: subject.userId,
          firstViewedAt: now,
          lastViewedAt: now,
          acknowledgedAt: now,
          acknowledgedVersion: 1,
        },
        update: {
          acknowledgedAt: now,
          acknowledgedVersion: 1,
        },
      });

      // Garante registro imediato na trilha de auditoria
      expect(mockAuditCreate).toHaveBeenCalledTimes(1);
      expect(mockAuditCreate).toHaveBeenCalledWith({
        data: {
          actorId: subject.userId,
          action: "PUBLICATION_ACKNOWLEDGED",
          entity: "publication",
          entityId: pubId,
          metadata: { version: 1 },
          ip: testIp,
        },
      });
    });

    it("repetir a confirmação na MESMA versão é idempotente e não gera duplicações nem novo log", async () => {
      const mockUpsert = vi.fn();
      const mockAuditCreate = vi.fn();

      const txMock = {
        publication: {
          findFirst: vi.fn().mockResolvedValue({
            id: pubId,
            version: 1,
            requiresAcknowledgement: true,
            // Leitura já confirmada na versão 1
            reads: [{ acknowledgedVersion: 1, acknowledgedAt: new Date("2026-10-01T09:00:00Z") }],
          }),
        },
        publicationRead: {
          upsert: mockUpsert,
        },
        auditLog: {
          create: mockAuditCreate,
        },
      };

      const prismaMock = {
        $transaction: vi.fn(async (cb) => cb(txMock)),
      } as unknown as PrismaClient;

      const result = await acknowledge(prismaMock, subject, pubId, now, testIp);

      // Retorna alreadyAcknowledged: true
      expect(result).toEqual({ alreadyAcknowledged: true });

      // NENHUMA gravação no banco nem na auditoria é disparada
      expect(mockUpsert).not.toHaveBeenCalled();
      expect(mockAuditCreate).not.toHaveBeenCalled();
    });

    it("nova versão material permite nova confirmação com gravação de data/hora atualizada", async () => {
      const mockUpsert = vi.fn().mockResolvedValue({});
      const mockAuditCreate = vi.fn().mockResolvedValue({});

      const txMock = {
        publication: {
          findFirst: vi.fn().mockResolvedValue({
            id: pubId,
            version: 2, // Publicação avançou para versão 2
            requiresAcknowledgement: true,
            // Usuário havia confirmado apenas a versão 1
            reads: [{ acknowledgedVersion: 1, acknowledgedAt: new Date("2026-09-01T00:00:00Z") }],
          }),
        },
        publicationRead: {
          upsert: mockUpsert,
        },
        auditLog: {
          create: mockAuditCreate,
        },
      };

      const prismaMock = {
        $transaction: vi.fn(async (cb) => cb(txMock)),
      } as unknown as PrismaClient;

      const result = await acknowledge(prismaMock, subject, pubId, now, testIp);

      expect(result).toEqual({ alreadyAcknowledged: false });

      // Atualiza com a nova versão 2 e novo timestamp
      expect(mockUpsert).toHaveBeenCalledWith({
        where: {
          publicationId_userId: { publicationId: pubId, userId: subject.userId },
        },
        create: {
          publicationId: pubId,
          userId: subject.userId,
          firstViewedAt: now,
          lastViewedAt: now,
          acknowledgedAt: now,
          acknowledgedVersion: 2,
        },
        update: {
          acknowledgedAt: now,
          acknowledgedVersion: 2,
        },
      });

      expect(mockAuditCreate).toHaveBeenCalledWith({
        data: {
          actorId: subject.userId,
          action: "PUBLICATION_ACKNOWLEDGED",
          entity: "publication",
          entityId: pubId,
          metadata: { version: 2 },
          ip: testIp,
        },
      });
    });

    it("lança ERR_ACK_NOT_REQUIRED se a publicação não exige confirmação", async () => {
      const txMock = {
        publication: {
          findFirst: vi.fn().mockResolvedValue({
            id: pubId,
            version: 1,
            requiresAcknowledgement: false, // Não exige confirmação
            reads: [],
          }),
        },
      };

      const prismaMock = {
        $transaction: vi.fn(async (cb) => cb(txMock)),
      } as unknown as PrismaClient;

      await expect(acknowledge(prismaMock, subject, pubId, now, testIp)).rejects.toThrow(
        expect.objectContaining({ code: "ERR_ACK_NOT_REQUIRED" })
      );
    });

    it("lança ERR_NOT_FOUND e bloqueia confirmação se o colaborador não faz parte da audiência", async () => {
      const txMock = {
        publication: {
          // findFirst com audienceFilter não encontra registro visível para o usuário
          findFirst: vi.fn().mockResolvedValue(null),
        },
      };

      const prismaMock = {
        $transaction: vi.fn(async (cb) => cb(txMock)),
      } as unknown as PrismaClient;

      await expect(acknowledge(prismaMock, subject, pubId, now, testIp)).rejects.toThrow(
        expect.objectContaining({ code: "ERR_NOT_FOUND" })
      );
    });
  });
});
