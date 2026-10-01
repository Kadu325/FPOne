/**
 * Normaliza o login digitado para o formato sAMAccountName.
 * Aceita: "joao.silva", "FP\joao.silva" ou "joao.silva@fazendaprogresso.com.local".
 * Retorna null se o valor for inválido.
 */
const MAX_USERNAME = 64;
const MAX_PASSWORD = 256;

// Caracteres proibidos em sAMAccountName pelo próprio AD + controles.
const FORBIDDEN = /["/\\[\]:;|=,+*?<>\u0000-\u001f\u007f]/;

export function normalizeUsername(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  let value = raw.trim();

  const slash = value.lastIndexOf("\\");
  if (slash >= 0) value = value.slice(slash + 1);

  const at = value.indexOf("@");
  if (at >= 0) value = value.slice(0, at);

  value = value.trim();
  if (value.length === 0 || value.length > MAX_USERNAME) return null;
  if (FORBIDDEN.test(value)) return null;
  return value;
}

export function isAcceptablePassword(raw: unknown): raw is string {
  return typeof raw === "string" && raw.length > 0 && raw.length <= MAX_PASSWORD;
}
