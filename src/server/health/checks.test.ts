import { describe, expect, it } from "vitest";
import { buildHealthReport } from "./checks";

const ok = async () => {};
const fail = async () => {
  throw new Error("connect ECONNREFUSED postgresql://user:senha@db");
};
const now = new Date("2026-09-29T12:00:00Z");

describe("buildHealthReport", () => {
  it("ok quando banco e storage respondem", async () => {
    const r = await buildHealthReport({ db: ok, storage: ok }, now);
    expect(r).toEqual({ status: "ok", checks: { web: "up", db: "up", storage: "up" }, timestamp: now.toISOString() });
  });

  it("degraded quando o banco cai, sem vazar detalhes do erro", async () => {
    const r = await buildHealthReport({ db: fail, storage: ok }, now);
    expect(r.status).toBe("degraded");
    expect(r.checks.db).toBe("down");
    expect(JSON.stringify(r)).not.toContain("senha");
  });

  it("degraded quando o storage cai", async () => {
    const r = await buildHealthReport({ db: ok, storage: fail }, now);
    expect(r.status).toBe("degraded");
    expect(r.checks.storage).toBe("down");
  });
});
