import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Mocks só entram pelo service layer (CLAUDE.md): componentes e rotas nunca importam @/mocks. */
const ROOTS = ["src/app", "src/components"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : /\.tsx?$/.test(name) ? [path.replaceAll("\\", "/")] : [];
  });
}

describe("guarda de mocks", () => {
  it("nenhum componente ou rota importa src/mocks", () => {
    const offenders = ROOTS.flatMap(walk).filter((p) => /from\s+["'](@\/mocks|[./]+\/mocks)\//.test(readFileSync(p, "utf8")));
    expect(offenders).toEqual([]);
  });
});
