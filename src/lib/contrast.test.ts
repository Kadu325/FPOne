import { describe, expect, it } from "vitest";
import { contrastRatio } from "./contrast";

describe("contrastRatio", () => {
  it("preto sobre branco é 21:1", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
  });

  it("é simétrico", () => {
    expect(contrastRatio("#007F5F", "#FFFFFF")).toBeCloseTo(contrastRatio("#FFFFFF", "#007F5F"), 10);
  });

  it("confere os valores da tabela do §186", () => {
    expect(contrastRatio("#007F5F", "#FFFFFF")).toBeCloseTo(5.0, 1);
    expect(contrastRatio("#0879C9", "#FFFFFF")).toBeCloseTo(4.58, 1);
    expect(contrastRatio("#86E800", "#FFFFFF")).toBeCloseTo(1.55, 1);
  });

  it("rejeita cor inválida", () => {
    expect(() => contrastRatio("verde", "#FFFFFF")).toThrow();
  });
});
