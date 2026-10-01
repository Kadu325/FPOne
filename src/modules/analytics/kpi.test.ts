import { describe, expect, it } from "vitest";
import { activityDay } from "@/server/analytics/collect";
import { formatPeriod, parsePeriod, periodWindow, rate } from "./kpi";

// 01/10/2026 10:00 na Bahia.
const NOW = new Date("2026-10-01T13:00:00Z");

describe("indicadores (§164)", () => {
  it("RN-KPI-007: taxa sem base é null, nunca 0% inventado", () => {
    expect(rate(0, 0)).toBeNull();
    expect(rate(5, 0)).toBeNull();
    expect(rate(0, 10)).toBe(0);
    expect(rate(191, 242)).toBe(79);
  });

  it("RN-KPI-004: janela de N dias terminando hoje no fuso da Bahia", () => {
    const w = periodWindow(NOW, 7);
    expect(w.endDay).toEqual(new Date("2026-10-01T00:00:00Z"));
    expect(w.startDay).toEqual(new Date("2026-09-25T00:00:00Z"));
    expect(w.startAt).toEqual(new Date("2026-09-25T03:00:00Z"));
    expect(w.previousStartDay).toEqual(new Date("2026-09-18T00:00:00Z"));
    expect(formatPeriod(w)).toBe("25/09/2026 a 01/10/2026");
  });

  it("às 23h na Bahia ainda é o mesmo dia (UTC já virou)", () => {
    expect(periodWindow(new Date("2026-10-02T02:30:00Z"), 7).endDay).toEqual(new Date("2026-10-01T00:00:00Z"));
    expect(activityDay(new Date("2026-10-02T02:30:00Z"))).toEqual(new Date("2026-10-01T00:00:00Z"));
  });

  it("período aceita só 7, 30 ou 90; padrão 30", () => {
    expect(parsePeriod("7")).toBe(7);
    expect(parsePeriod("90")).toBe(90);
    expect(parsePeriod("365")).toBe(30);
    expect(parsePeriod(undefined)).toBe(30);
  });
});
