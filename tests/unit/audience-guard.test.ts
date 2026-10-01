import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guarda de audiência (§182): nenhum arquivo de src/server ou src/modules pode consultar
 * publication, document, event ou usefulLink sem usar audienceFilter. Exceções precisam ser explícitas aqui.
 */
const ROOTS = ["src/server", "src/modules"];
/** Exceção da RN-CORE-002: área administrativa com permissão explícita (assertCan em cada função). */
const ALLOWED: readonly string[] = ["src/server/publications/admin.ts", "src/server/links/admin.ts", "src/server/events/admin.ts", "src/server/documents/admin.ts", "src/server/analytics/kpis.ts"];
const QUERY = /\.(publication|document|event|usefulLink)(Audience)?\s*\.\s*(findMany|findFirst|findUnique|findFirstOrThrow|findUniqueOrThrow|count|aggregate|groupBy)\s*\(/g;

function walk(dir: string): string[] {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out = out.concat(walk(path));
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(path.replaceAll("\\", "/"));
  }
  return out;
}

/** Argumentos da chamada que começa no "(" em `open`, até o ")" que o fecha. */
function callArgs(source: string, open: number): string {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "(") depth++;
    else if (source[i] === ")" && --depth === 0) return source.slice(open, i + 1);
  }
  return source.slice(open);
}

/** Cada chamada de consulta precisa de audienceFilter nos próprios argumentos, não só em algum lugar do arquivo. */
export function violations(files: readonly { path: string; source: string }[]): string[] {
  return files
    .filter((f) => !ALLOWED.includes(f.path))
    .filter((f) => [...f.source.matchAll(QUERY)].some((m) => !callArgs(f.source, m.index + m[0].length - 1).includes("audienceFilter(")))
    .map((f) => f.path);
}

describe("guarda de audiência", () => {
  it("detecta consulta sem audienceFilter", () => {
    expect(violations([{ path: "x.ts", source: "db().publication.findMany({ where: {} })" }])).toEqual(["x.ts"]);
    expect(violations([{ path: "y.ts", source: "db().document.findFirst({ where: { ...audienceFilter(s) } })" }])).toEqual([]);
  });

  it("não aceita consulta sem filtro escondida ao lado de outra filtrada", () => {
    const source = "db().event.findMany({ where: { ...audienceFilter(s) } });\ndb().event.count({ where: {} });";
    expect(violations([{ path: "z.ts", source }])).toEqual(["z.ts"]);
  });

  it("nenhum repositório consulta Publication, Document ou Event sem audienceFilter", () => {
    const files = ROOTS.flatMap(walk).map((path) => ({ path, source: readFileSync(path, "utf8") }));
    expect(violations(files)).toEqual([]);
  });
});
