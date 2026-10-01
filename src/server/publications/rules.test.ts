import { describe, expect, it } from "vitest";
import { BusinessError } from "@/lib/errors";
import type { RichDoc } from "@/modules/publications/content";
import {
  assertPublishable,
  assertTypeRules,
  canTransition,
  computeMetrics,
  effectiveStatus,
  hasValidAcknowledgement,
  recipientsWhere,
  visibleWhere,
  type PublicationDraft,
} from "./rules";

const NOW = new Date("2026-09-29T13:00:00Z");
const doc = (text: string): RichDoc => ({ type: "doc", content: [{ type: "paragraph", content: text ? [{ type: "text", text }] : [] }] });
const draft = (over: Partial<PublicationDraft> = {}): PublicationDraft => ({
  type: "ANNOUNCEMENT",
  title: "Política",
  content: doc("Texto"),
  requiresAcknowledgement: false,
  pinned: false,
  audiences: [{ audienceType: "ALL", audienceId: null }],
  publishAt: null,
  expiresAt: null,
  ...over,
});
const code = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    return e instanceof BusinessError ? e.code : "other";
  }
  return null;
};

describe("transições (§171, RN-COM-001)", () => {
  it("permite as previstas e recusa as demais", () => {
    expect(canTransition("DRAFT", "PUBLISHED")).toBe(true);
    expect(canTransition("SCHEDULED", "DRAFT")).toBe(true);
    expect(canTransition("PUBLISHED", "ARCHIVED")).toBe(true);
    expect(canTransition("EXPIRED", "ARCHIVED")).toBe(true);
    expect(canTransition("PUBLISHED", "DRAFT")).toBe(false);
    expect(canTransition("ARCHIVED", "PUBLISHED")).toBe(false);
    expect(canTransition("EXPIRED", "PUBLISHED")).toBe(false);
  });
});

describe("vigência na leitura (RN-COM-005/006)", () => {
  const past = new Date("2026-09-29T12:00:00Z");
  const future = new Date("2026-09-29T14:00:00Z");

  it("agendado vira publicado no horário e publicado vira expirado", () => {
    expect(effectiveStatus({ status: "SCHEDULED", publishAt: future, expiresAt: null }, NOW)).toBe("SCHEDULED");
    expect(effectiveStatus({ status: "SCHEDULED", publishAt: past, expiresAt: null }, NOW)).toBe("PUBLISHED");
    expect(effectiveStatus({ status: "PUBLISHED", publishAt: past, expiresAt: past }, NOW)).toBe("EXPIRED");
    expect(effectiveStatus({ status: "SCHEDULED", publishAt: past, expiresAt: past }, NOW)).toBe("EXPIRED");
  });

  it("o WHERE do feed exige publish_at vencido e expires_at futuro ou nulo", () => {
    expect(visibleWhere(NOW)).toEqual({
      status: { in: ["SCHEDULED", "PUBLISHED"] },
      publishAt: { lte: NOW },
      OR: [{ expiresAt: null }, { expiresAt: { gt: NOW } }],
    });
  });
});

describe("validação de publicação", () => {
  it("RN-NEWS-001: novidade não exige ciência nem é fixada", () => {
    expect(code(() => assertTypeRules({ type: "NEWS", requiresAcknowledgement: true, pinned: false }))).toBe("ERR_INVALID_PUBLICATION_TYPE");
    expect(code(() => assertTypeRules({ type: "NEWS", requiresAcknowledgement: false, pinned: true }))).toBe("ERR_INVALID_PUBLICATION_TYPE");
    expect(code(() => assertTypeRules({ type: "ANNOUNCEMENT", requiresAcknowledgement: true, pinned: true }))).toBeNull();
  });

  it("RN-COM-002: sem título ou conteúdo não publica", () => {
    expect(code(() => assertPublishable(draft({ title: "  " }), "PUBLISHED", NOW))).toBe("ERR_PUBLICATION_INCOMPLETE");
    expect(code(() => assertPublishable(draft({ content: doc("") }), "PUBLISHED", NOW))).toBe("ERR_PUBLICATION_INCOMPLETE");
  });

  it("RN-COM-003: exige público válido", () => {
    expect(code(() => assertPublishable(draft({ audiences: [] }), "PUBLISHED", NOW))).toBe("ERR_PUBLICATION_NO_AUDIENCE");
    expect(code(() => assertPublishable(draft({ audiences: [{ audienceType: "UNIT", audienceId: " " }] }), "PUBLISHED", NOW))).toBe("ERR_PUBLICATION_NO_AUDIENCE");
    expect(code(() => assertPublishable(draft({ audiences: [{ audienceType: "UNIT", audienceId: "Matriz" }] }), "PUBLISHED", NOW))).toBeNull();
  });

  it("agendamento no futuro e expiração depois do início", () => {
    const later = new Date("2026-10-01T12:00:00Z");
    expect(code(() => assertPublishable(draft({ publishAt: NOW }), "SCHEDULED", NOW))).toBe("ERR_INVALID_SCHEDULE");
    expect(code(() => assertPublishable(draft({ publishAt: later, expiresAt: later }), "SCHEDULED", NOW))).toBe("ERR_INVALID_SCHEDULE");
    expect(code(() => assertPublishable(draft({ expiresAt: NOW }), "PUBLISHED", NOW))).toBe("ERR_INVALID_SCHEDULE");
    expect(code(() => assertPublishable(draft({ publishAt: later }), "SCHEDULED", NOW))).toBeNull();
  });
});

describe("ciência por versão (RN-ACK-002/006)", () => {
  it("vale só para a versão atual", () => {
    expect(hasValidAcknowledgement({ acknowledgedVersion: 2 }, 2)).toBe(true);
    expect(hasValidAcknowledgement({ acknowledgedVersion: 1 }, 2)).toBe(false);
    expect(hasValidAcknowledgement({ acknowledgedVersion: null }, 1)).toBe(false);
    expect(hasValidAcknowledgement(undefined, 1)).toBe(false);
  });
});

describe("destinatários e métricas (RN-ACK-004/005/007)", () => {
  it("ALL = todos os ativos; USER soma; UNIT e DEPARTMENT combinam por E", () => {
    expect(recipientsWhere([{ audienceType: "ALL", audienceId: null }])).toEqual({ employee: { status: "ACTIVE" } });
    expect(
      recipientsWhere([
        { audienceType: "UNIT", audienceId: "Matriz" },
        { audienceType: "UNIT", audienceId: "Sede" },
        { audienceType: "DEPARTMENT", audienceId: "Fiscal" },
        { audienceType: "USER", audienceId: "u1" },
      ]),
    ).toEqual({
      AND: [
        { employee: { status: "ACTIVE" } },
        { OR: [{ id: { in: ["u1"] } }, { AND: [{ employee: { unit: { in: ["Matriz", "Sede"] } } }, { employee: { department: { in: ["Fiscal"] } } }] }] },
      ],
    });
  });

  it("público sem correspondência não casa ninguém", () => {
    expect(recipientsWhere([{ audienceType: "GROUP", audienceId: "g1" }])).toEqual({ id: { in: [] } });
  });

  it("taxas sobre destinatários; sem destinatário, taxa nula", () => {
    expect(computeMetrics(242, 218, 191, true)).toEqual({ recipients: 242, viewed: 218, acknowledged: 191, pending: 51, readRate: 90, ackRate: 79 });
    expect(computeMetrics(0, 0, 0, true).ackRate).toBeNull();
    expect(computeMetrics(10, 5, 0, false)).toMatchObject({ pending: 0, ackRate: null });
  });
});
