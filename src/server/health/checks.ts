export type CheckStatus = "up" | "down";

export interface HealthReport {
  status: "ok" | "degraded";
  checks: { web: CheckStatus; db: CheckStatus; storage: CheckStatus };
  timestamp: string;
}

export type Probe = () => Promise<void>;

const TIMEOUT_MS = 3000;

async function run(probe: Probe): Promise<CheckStatus> {
  try {
    await Promise.race([
      probe(),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), TIMEOUT_MS)),
    ]);
    return "up";
  } catch {
    // Detalhes do erro não saem na resposta (podem conter host/credenciais).
    return "down";
  }
}

export async function buildHealthReport(probes: { db: Probe; storage: Probe }, now = new Date()): Promise<HealthReport> {
  const [db, storage] = await Promise.all([run(probes.db), run(probes.storage)]);
  return {
    status: db === "up" && storage === "up" ? "ok" : "degraded",
    checks: { web: "up", db, storage },
    timestamp: now.toISOString(),
  };
}
