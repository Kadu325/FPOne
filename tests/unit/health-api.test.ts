import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock das dependências antes de importar a rota
vi.mock("@/server/db", () => ({
  db: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  serverEnv: vi.fn(() => ({
    MINIO_ENDPOINT: "http://minio:9000",
  })),
}));

import { GET } from "@/app/api/health/route";
import { db } from "@/server/db";

describe("Healthcheck Endpoint (GET /api/health) (§182)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("retorna HTTP 200 com status 'ok' quando banco e MinIO S3 respondem normalmente", async () => {
    // DB mock saudável
    vi.mocked(db).mockReturnValue({
      $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    } as any);

    // Global fetch mock saudável
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 200,
    } as any);

    const res = await GET();

    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    const json = await res.json();
    expect(json).toMatchObject({
      status: "ok",
      checks: {
        web: "up",
        db: "up",
        storage: "up",
      },
    });
    expect(json.timestamp).toBeDefined();
  });

  it("retorna HTTP 503 e status 'degraded' se o banco de dados falhar", async () => {
    vi.mocked(db).mockReturnValue({
      $queryRaw: vi.fn().mockRejectedValue(new Error("Connection refused postgresql://secret:pass@db:5432")),
    } as any);

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      status: 200,
    } as any);

    const res = await GET();

    expect(res.status).toBe(503);
    const json = await res.json();

    expect(json).toMatchObject({
      status: "degraded",
      checks: {
        web: "up",
        db: "down",
        storage: "up",
      },
    });

    // Garante que credenciais e dados internos do banco NUNCA vazam na resposta (§182)
    const rawResponse = JSON.stringify(json);
    expect(rawResponse).not.toContain("secret");
    expect(rawResponse).not.toContain("pass");
    expect(rawResponse).not.toContain("5432");
  });

  it("retorna HTTP 503 e status 'degraded' se o armazenamento MinIO S3 estiver fora do ar", async () => {
    vi.mocked(db).mockReturnValue({
      $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    } as any);

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("connect ECONNREFUSED minio:9000"));

    const res = await GET();

    expect(res.status).toBe(503);
    const json = await res.json();

    expect(json).toMatchObject({
      status: "degraded",
      checks: {
        web: "up",
        db: "up",
        storage: "down",
      },
    });
  });

  it("retorna HTTP 503 e status 'degraded' se tanto o banco quanto o storage falharem", async () => {
    vi.mocked(db).mockReturnValue({
      $queryRaw: vi.fn().mockRejectedValue(new Error("DB DOWN")),
    } as any);

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("STORAGE DOWN"));

    const res = await GET();

    expect(res.status).toBe(503);
    const json = await res.json();

    expect(json).toMatchObject({
      status: "degraded",
      checks: {
        web: "up",
        db: "down",
        storage: "down",
      },
    });
  });
});
