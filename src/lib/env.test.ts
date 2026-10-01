import { describe, expect, it } from "vitest";
import { parseServerEnv } from "./env";

// Base com GARAGE_ENDPOINT (variável principal após migração MinIO → Garage)
const base = {
  DATABASE_URL: "postgresql://u:segredo@db:5432/fpone",
  GARAGE_ENDPOINT: "http://garage:3900",
  AUTH_SECRET: "a".repeat(32),
  CPF_PEPPER: "p".repeat(32),
};

// Base legada com MINIO_ENDPOINT (compatibilidade retroativa)
const baseLegacy = {
  DATABASE_URL: "postgresql://u:segredo@db:5432/fpone",
  MINIO_ENDPOINT: "http://minio:9000",
  AUTH_SECRET: "a".repeat(32),
  CPF_PEPPER: "p".repeat(32),
};

describe("parseServerEnv", () => {
  it("flags ficam desligadas por padrão", () => {
    const env = parseServerEnv(base);
    expect(env.DEMO_MODE).toBe(false);
    expect(env.FEATURE_AI_SEARCH).toBe(false);
  });

  it("liga flag com 'true'", () => {
    expect(parseServerEnv({ ...base, DEMO_MODE: "true" }).DEMO_MODE).toBe(true);
  });

  it("erro cita o nome da variável, nunca o valor", () => {
    const bad = { ...base, DATABASE_URL: "nao-e-url-segredo" };
    expect(() => parseServerEnv(bad)).toThrow(/DATABASE_URL/);
    expect(() => parseServerEnv(bad)).not.toThrow(/segredo/);
  });

  it("exige CPF_PEPPER e AUTH_SECRET com 32+ caracteres", () => {
    expect(() => parseServerEnv({ ...base, CPF_PEPPER: "curto" })).toThrow(/CPF_PEPPER/);
    expect(() => parseServerEnv({ ...base, AUTH_SECRET: undefined })).toThrow(/AUTH_SECRET/);
  });

  it("aceita MINIO_ENDPOINT como fallback (compatibilidade legada)", () => {
    // Ambientes que ainda usam MINIO_ENDPOINT devem continuar funcionando
    expect(() => parseServerEnv(baseLegacy)).not.toThrow();
    const env = parseServerEnv(baseLegacy);
    expect(env.MINIO_ENDPOINT).toBe("http://minio:9000");
  });

  it("exige pelo menos GARAGE_ENDPOINT ou MINIO_ENDPOINT", () => {
    const noStorage = { ...base, GARAGE_ENDPOINT: undefined };
    // Sem nenhum dos dois, deve lançar erro
    expect(() => parseServerEnv({ DATABASE_URL: base.DATABASE_URL, AUTH_SECRET: base.AUTH_SECRET, CPF_PEPPER: base.CPF_PEPPER })).toThrow(/GARAGE_ENDPOINT/);
  });
});
