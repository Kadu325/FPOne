import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * CPF (§184, LGPD): gravado como HMAC na carga CSV.
 * Nunca persistir, logar, auditar ou devolver o valor: só o HMAC.
 */

/** Remove máscara; devolve 11 dígitos ou null. */
export function normalizeCpf(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return digits.length === 11 ? digits : null;
}

/** Valida os dígitos verificadores e rejeita sequências repetidas (000..., 111...). */
export function isValidCpf(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const digits = [...cpf].map(Number);
  const check = (len: number) => {
    const sum = digits.slice(0, len).reduce((acc, d, i) => acc + d * (len + 1 - i), 0);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === digits[9] && check(10) === digits[10];
}

/** HMAC-SHA256(cpf_normalizado, pepper) em hex. */
export function hashCpf(normalizedCpf: string, pepper: string): string {
  return createHmac("sha256", pepper).update(normalizedCpf).digest("hex");
}

/** Comparação em tempo constante entre o HMAC calculado e o armazenado. */
export function cpfHashMatches(normalizedCpf: string, storedHash: string, pepper: string): boolean {
  const a = Buffer.from(hashCpf(normalizedCpf, pepper), "hex");
  const b = Buffer.from(storedHash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
