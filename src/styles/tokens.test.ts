import { describe, expect, it } from "vitest";
import { brand, surface, textSafeOn } from "./tokens";
import { AA_NORMAL_TEXT, contrastRatio } from "@/lib/contrast";

describe("tokens da marca (§186)", () => {
  it("mantém os HEX oficiais", () => {
    expect(brand).toEqual({
      lime: "#86E800",
      green: "#00B63B",
      emerald: "#007F5F",
      teal: "#00B7B1",
      cyan: "#13BDEB",
      blue: "#0879C9",
      ink: "#0B2430",
    });
    expect(surface.bg).toBe("#F7FAF9");
  });

  const cases = (Object.keys(textSafeOn) as (keyof typeof textSafeOn)[]).flatMap((bg) =>
    textSafeOn[bg].map((name) => [name, bg] as const),
  );

  it.each(cases)("%s atinge AA como texto sobre %s", (name, bg) => {
    expect(contrastRatio(brand[name], surface[bg])).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
  });

  it("azul não é permitido como texto sobre bg nem mist (fica abaixo de AA)", () => {
    expect(textSafeOn.bg).not.toContain("blue");
    expect(textSafeOn.mist).not.toContain("blue");
    expect(contrastRatio(brand.blue, surface.bg)).toBeLessThan(AA_NORMAL_TEXT);
  });

  it.each(["lime", "green", "teal", "cyan"] as const)("%s fica fora de toda lista de texto em fundo claro", (name) => {
    for (const list of Object.values(textSafeOn)) expect(list).not.toContain(name);
    expect(contrastRatio(brand[name], surface.white)).toBeLessThan(AA_NORMAL_TEXT);
  });

  it("limão, bandeira, turquesa e ciano atingem AA como texto sobre ink", () => {
    for (const name of ["lime", "green", "teal", "cyan"] as const) {
      expect(contrastRatio(brand[name], brand.ink)).toBeGreaterThanOrEqual(AA_NORMAL_TEXT);
    }
  });
});
