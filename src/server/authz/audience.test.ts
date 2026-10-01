import { describe, expect, it } from "vitest";
import { audienceFilter, isInAudience, type AudienceSubject } from "./audience";

const subject: AudienceSubject = { userId: "u1", unit: "Fazenda Norte", department: "Operações", groupIds: [] };
type Row = { audienceType: "ALL" | "UNIT" | "DEPARTMENT" | "GROUP" | "USER"; audienceId: string | null };
const row = (audienceType: Row["audienceType"], audienceId: string | null = null): Row => ({ audienceType, audienceId });

describe("regra de combinação de públicos (RN-CORE-002, §64, decisão da Fase 6)", () => {
  it("ALL e USER listado sempre recebem", () => {
    expect(isInAudience(subject, [row("ALL")])).toBe(true);
    expect(isInAudience(subject, [row("USER", "u1")])).toBe(true);
    expect(isInAudience(subject, [row("UNIT", "Fazenda Sul"), row("USER", "u1")])).toBe(true);
  });

  it("OU dentro do mesmo tipo", () => {
    expect(isInAudience(subject, [row("UNIT", "Fazenda Sul"), row("UNIT", "Fazenda Norte")])).toBe(true);
    expect(isInAudience(subject, [row("DEPARTMENT", "Financeiro"), row("DEPARTMENT", "Operações")])).toBe(true);
  });

  it("E entre tipos: unidade + departamento exige os dois", () => {
    expect(isInAudience(subject, [row("UNIT", "Fazenda Norte"), row("DEPARTMENT", "Operações")])).toBe(true);
    expect(isInAudience(subject, [row("UNIT", "Fazenda Norte"), row("DEPARTMENT", "Financeiro")])).toBe(false);
    expect(isInAudience(subject, [row("UNIT", "Fazenda Sul"), row("DEPARTMENT", "Operações")])).toBe(false);
  });

  it("recusa sem audiência, USER de outro, grupo sem cadastro e unidade vazia", () => {
    expect(isInAudience(subject, [])).toBe(false);
    expect(isInAudience(subject, [row("USER", "u2")])).toBe(false);
    expect(isInAudience(subject, [row("GROUP", "g1")])).toBe(false);
    expect(isInAudience({ ...subject, unit: "" }, [row("UNIT", "")])).toBe(false);
  });

  it("grupo casa quando o usuário pertence", () => {
    expect(isInAudience({ ...subject, groupIds: ["g1"] }, [row("GROUP", "g1"), row("UNIT", "Fazenda Norte")])).toBe(true);
  });
});

describe("audienceFilter (formato Prisma)", () => {
  it("expressa ALL, USER e a conjunção dos tipos estruturais", () => {
    expect(audienceFilter(subject)).toEqual({
      OR: [
        { audiences: { some: { audienceType: "ALL" } } },
        { audiences: { some: { audienceType: "USER", audienceId: "u1" } } },
        {
          AND: [
            {
              OR: [
                { audiences: { some: { audienceType: "UNIT" } } },
                { audiences: { some: { audienceType: "DEPARTMENT" } } },
                { audiences: { some: { audienceType: "GROUP" } } },
              ],
            },
            { OR: [{ audiences: { none: { audienceType: "UNIT" } } }, { audiences: { some: { audienceType: "UNIT", audienceId: { in: ["Fazenda Norte"] } } } }] },
            { OR: [{ audiences: { none: { audienceType: "DEPARTMENT" } } }, { audiences: { some: { audienceType: "DEPARTMENT", audienceId: { in: ["Operações"] } } } }] },
            { OR: [{ audiences: { none: { audienceType: "GROUP" } } }] },
          ],
        },
      ],
    });
  });
});
