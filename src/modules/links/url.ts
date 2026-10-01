/**
 * RN-LNK-004: só http/https ou rota interna válida ("/algo", nunca "//host" nem "/\\host").
 * Bloqueia javascript:, data:, file: e afins.
 */
export function isSafeLinkUrl(value: string): boolean {
  const v = value.trim();
  if (v.startsWith("/")) return !v.startsWith("//") && !v.startsWith("/\\") && /^\/[\w\-./?=&%#~+]*$/.test(v);
  try {
    const url = new URL(v);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname !== "";
  } catch {
    return false;
  }
}

export function isInternalLink(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//");
}
