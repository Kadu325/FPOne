/**
 * Log estruturado (JSON por linha) — vai para stdout do container.
 * NUNCA registre senhas. Detalhes técnicos ficam aqui, não na resposta HTTP.
 */
type Level = "info" | "warn" | "error";

export function logAuthEvent(level: Level, event: string, data: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...data });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}

/** Extrai apenas o que é útil para diagnóstico de um erro qualquer. */
export function describeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const e = err as Error & { code?: unknown };
    return { errName: e.name, errCode: e.code, errMessage: e.message };
  }
  return { errMessage: String(err) };
}
