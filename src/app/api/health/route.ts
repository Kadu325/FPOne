import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { serverEnv } from "@/lib/env";
import { buildHealthReport } from "@/server/health/checks";

export const dynamic = "force-dynamic";

/** GET /api/health: verifica web, banco e MinIO S3 (§182). */
export async function GET() {
  const report = await buildHealthReport({
    db: async () => {
      await db().$queryRaw`SELECT 1`;
    },
    storage: async () => {
      // MinIO expõe /minio/health/live ou responde na raiz da S3 API.
      const env = serverEnv();
      const endpoint = env.MINIO_ENDPOINT ?? env.GARAGE_ENDPOINT ?? "http://minio:9000";
      try {
        const liveRes = await fetch(new URL("/minio/health/live", endpoint), { cache: "no-store", method: "GET" });
        if (liveRes.ok) return;
      } catch {
        // Fallback para requisição na raiz se endpoint customizado
      }
      const res = await fetch(new URL("/", endpoint), { cache: "no-store", method: "HEAD" });
      if (res.status === 0) throw new Error("Storage S3 inacessível");
    },
  });
  return NextResponse.json(report, {
    status: report.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
