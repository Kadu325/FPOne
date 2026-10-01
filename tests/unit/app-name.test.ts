import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_NAME } from "@/lib/constants";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === "generated") return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|css)$/.test(path) ? [path] : [];
  });
}

describe("nome do produto (§181)", () => {
  it("APP_NAME é FPOne Intranet", () => {
    expect(APP_NAME).toBe("FPOne Intranet");
  });

  it("nenhum arquivo de src usa nome proibido nem repete a string solta", () => {
    const offenders: string[] = [];
    for (const file of sourceFiles("src")) {
      const text = readFileSync(file, "utf8");
      if (/Digital Workplace|(?<!FP)ONE Intranet/.test(text)) offenders.push(`${file}: nome proibido`);
      const isConstants = file.endsWith(join("lib", "constants.ts"));
      const isTest = file.endsWith(".test.ts");
      if (!isConstants && !isTest && text.includes('"FPOne Intranet"')) offenders.push(`${file}: use APP_NAME`);
    }
    expect(offenders).toEqual([]);
  });
});
