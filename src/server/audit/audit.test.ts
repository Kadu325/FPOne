import { describe, expect, it } from "vitest";
import { assertSafeMetadata } from "./audit";

describe("metadata de auditoria (LGPD, §184)", () => {
  it("aceita totais e identificadores técnicos", () => {
    expect(() => assertSafeMetadata({ total: 10, created: 3, reason: "wrong_pin" })).not.toThrow();
  });

  it.each(["cpf", "cpfHash", "pin", "newPin", "password", "sessionToken"])("rejeita a chave %s", (key) => {
    expect(() => assertSafeMetadata({ [key]: "x" })).toThrow(/proibida/);
  });
});
