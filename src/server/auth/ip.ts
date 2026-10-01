/**
 * IP do cliente para o limite por IP (RN-AUTH-008). O único proxy é o Caddy (§182), que define
 * X-Forwarded-For com o IP real; usamos o primeiro valor. Sem cabeçalho, devolve null.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first && /^[0-9a-fA-F:.]{2,45}$/.test(first)) return first;
  const real = headers.get("x-real-ip")?.trim();
  return real && /^[0-9a-fA-F:.]{2,45}$/.test(real) ? real : null;
}
