import { describe, expect, it } from "vitest";
import { isInternalLink, isSafeLinkUrl } from "./url";

describe("URL de link útil (RN-LNK-004)", () => {
  it("aceita http, https e rota interna", () => {
    expect(isSafeLinkUrl("https://sankhya.fazenda.com")).toBe(true);
    expect(isSafeLinkUrl("http://chamados.local")).toBe(true);
    expect(isSafeLinkUrl("/documentos")).toBe(true);
  });

  it("recusa protocolos inseguros e rotas ambíguas", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "file:///etc/passwd", "//evil.com", String.raw`/\evil.com`, "ftp://x.com", "", "sankhya"]) {
      expect(isSafeLinkUrl(bad), bad).toBe(false);
    }
  });

  it("identifica links internos", () => {
    expect(isInternalLink("/agenda")).toBe(true);
    expect(isInternalLink("https://x.com")).toBe(false);
    expect(isInternalLink("//x.com")).toBe(false);
  });
});
