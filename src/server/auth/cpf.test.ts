import { describe, expect, it } from "vitest";
import { cpfHashMatches, hashCpf, isValidCpf, normalizeCpf } from "./cpf";

// CPFs gerados para teste (dígitos verificadores válidos, não pertencem a pessoas reais conhecidas).
const VALID = "52998224725";
const PEPPER = "p".repeat(32);

describe("normalizeCpf", () => {
  it("remove máscara", () => {
    expect(normalizeCpf("529.982.247-25")).toBe(VALID);
  });
  it("rejeita tamanho errado", () => {
    expect(normalizeCpf("123")).toBeNull();
    expect(normalizeCpf("529.982.247-255")).toBeNull();
  });
});

describe("isValidCpf", () => {
  it("aceita CPF com dígitos corretos", () => {
    expect(isValidCpf(VALID)).toBe(true);
    expect(isValidCpf("11144477735")).toBe(true);
  });
  it("rejeita dígito verificador errado", () => {
    expect(isValidCpf("52998224724")).toBe(false);
  });
  it("rejeita sequências repetidas", () => {
    expect(isValidCpf("00000000000")).toBe(false);
    expect(isValidCpf("11111111111")).toBe(false);
  });
});

describe("hashCpf (RN-AUTH-006, LGPD)", () => {
  it("é determinístico e não contém o CPF", () => {
    const h = hashCpf(VALID, PEPPER);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(h).toBe(hashCpf(VALID, PEPPER));
    expect(h).not.toContain(VALID);
  });
  it("depende do pepper", () => {
    expect(hashCpf(VALID, PEPPER)).not.toBe(hashCpf(VALID, "q".repeat(32)));
  });
  it("cpfHashMatches confere e rejeita", () => {
    const stored = hashCpf(VALID, PEPPER);
    expect(cpfHashMatches(VALID, stored, PEPPER)).toBe(true);
    expect(cpfHashMatches("11144477735", stored, PEPPER)).toBe(false);
    expect(cpfHashMatches(VALID, "abc", PEPPER)).toBe(false);
  });
});
