import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { serverEnv } from "@/lib/env";
import { buildHealthReport } from "@/server/health/checks";

export const dynamic = "force-dynamic";

/** GET /api/health: verifica web, banco e Garage S3 (§182). */
export async function GET() {
  const report = await buildHealthReport({
    db: async () => {
      await db().$queryRaw`SELECT 1`;
    },
    storage: async () => {
      // Garage expõe /health na Admin API (porta 3903) ou responde na S3 API (porta 3900).
      // Usamos a S3 API para verificar disponibilidade — compatível com a URL GARAGE_ENDPOINT.
      const env = serverEnv();
      const endpoint = env.GARAGE_ENDPOINT ?? env.MINIO_ENDPOINT;
      const res = await fetch(new URL("/", endpoint!), { cache: "no-store", method: "HEAD" });
      // Garage retorna 400 (sem autenticação) ou 200 na raiz — qualquer resposta HTTP indica que está vivo.
      if (res.status === 0) throw new Error(`Garage inacessível`);
    },
  });
  return NextResponse.json(report, {
    status: report.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
