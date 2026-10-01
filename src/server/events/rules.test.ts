import { describe, expect, it } from "vitest";
import { BusinessError } from "@/lib/errors";
import { formatEventRange } from "@/modules/events/format";
import { assertEventDates, assertEventTransition, dayBounds, effectiveEventStatus } from "./rules";

const NOW = new Date("2026-09-29T13:00:00Z"); // 10:00 na Bahia
const code = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    return e instanceof BusinessError ? e.code : "other";
  }
  return null;
};

describe("eventos (§160, §171)", () => {
  it("RN-EVT-002: término não pode ser anterior ao início", () => {
    expect(code(() => assertEventDates(new Date("2026-10-01T15:00:00Z"), new Date("2026-10-01T14:00:00Z")))).toBe("ERR_INVALID_EVENT_DATES");
    expect(code(() => assertEventDates(new Date("2026-10-01T15:00:00Z"), new Date("2026-10-01T15:00:00Z")))).toBeNull();
    expect(code(() => assertEventDates(new Date("x"), new Date()))).toBe("ERR_INVALID_EVENT_DATES");
  });

  it("transições: rascunho publica, publicado cancela, cancelado não volta", () => {
    expect(code(() => assertEventTransition("DRAFT", "PUBLISHED"))).toBeNull();
    expect(code(() => assertEventTransition("PUBLISHED", "CANCELLED"))).toBeNull();
    expect(code(() => assertEventTransition("CANCELLED", "PUBLISHED"))).toBe("ERR_INVALID_TRANSITION");
    expect(code(() => assertEventTransition("DRAFT", "CANCELLED"))).toBe("ERR_INVALID_TRANSITION");
  });

  it("publicado que já terminou é encerrado; cancelado continua cancelado", () => {
    expect(effectiveEventStatus({ status: "PUBLISHED", endAt: new Date("2026-09-29T12:00:00Z") }, NOW)).toBe("FINISHED");
    expect(effectiveEventStatus({ status: "PUBLISHED", endAt: new Date("2026-09-29T14:00:00Z") }, NOW)).toBe("PUBLISHED");
    expect(effectiveEventStatus({ status: "CANCELLED", endAt: new Date("2026-09-29T12:00:00Z") }, NOW)).toBe("CANCELLED");
  });

  it("dia corrente no fuso da Bahia", () => {
    expect(dayBounds(NOW)).toEqual({ start: new Date("2026-09-29T03:00:00Z"), end: new Date("2026-09-30T03:00:00Z") });
    expect(dayBounds(new Date("2026-09-30T02:30:00Z")).start).toEqual(new Date("2026-09-29T03:00:00Z"));
  });

  it("formata intervalo no horário local", () => {
    expect(formatEventRange(new Date("2026-09-29T17:30:00Z"), new Date("2026-09-29T19:00:00Z"))).toMatch(/29\/09 · 14:30–16:00$/);
  });
});
