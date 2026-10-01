import { describe, expect, it } from "vitest";
import { EMPTY_DOC, isSafeHref, parseStoredDoc, plainText, richDocSchema } from "./content";
import { fromLocalInput, publicationInputSchema, toLocalInput } from "./schema";

describe("conteúdo TipTap restrito (§63)", () => {
  it("aceita os nós do MVP", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "Título" }] },
        { type: "paragraph", content: [{ type: "text", text: "Olá", marks: [{ type: "bold" }, { type: "link", attrs: { href: "https://fp.com.br" } }] }] },
        { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: "item" }] }] }] },
        { type: "horizontalRule" },
      ],
    };
    expect(richDocSchema.safeParse(doc).success).toBe(true);
    expect(plainText(richDocSchema.parse(doc))).toBe("Título Olá item");
  });

  it("rejeita nó desconhecido, heading 1 e link inseguro", () => {
    expect(richDocSchema.safeParse({ type: "doc", content: [{ type: "image", attrs: { src: "x" } }] }).success).toBe(false);
    expect(richDocSchema.safeParse({ type: "doc", content: [{ type: "heading", attrs: { level: 1 } }] }).success).toBe(false);
    const link = (href: string) => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "x", marks: [{ type: "link", attrs: { href } }] }] }] });
    expect(richDocSchema.safeParse(link("javascript:alert(1)")).success).toBe(false);
    expect(richDocSchema.safeParse(link("http://inseguro.com")).success).toBe(false);
  });

  it("só https e mailto", () => {
    expect(isSafeHref("https://a.com")).toBe(true);
    expect(isSafeHref("mailto:rh@fp.com.br")).toBe(true);
    expect(isSafeHref("data:text/html,x")).toBe(false);
    expect(isSafeHref("/relativo")).toBe(false);
  });

  it("JSON inválido do banco vira documento vazio", () => {
    expect(parseStoredDoc({ type: "doc", content: [{ type: "script" }] })).toEqual(EMPTY_DOC);
    expect(parseStoredDoc("<b>html</b>")).toEqual(EMPTY_DOC);
  });
});

describe("entrada do editor", () => {
  const base = {
    type: "ANNOUNCEMENT",
    title: " Título ",
    summary: "",
    content: EMPTY_DOC,
    categoryId: null,
    isFeatured: false,
    pinned: false,
    requiresAcknowledgement: true,
    audiences: [{ audienceType: "ALL", audienceId: null }],
    publishAt: "",
    expiresAt: "2026-10-01T18:00",
  };

  it("normaliza título e datas vazias", () => {
    const parsed = publicationInputSchema.parse(base);
    expect(parsed.title).toBe("Título");
    expect(parsed.publishAt).toBeNull();
    expect(parsed.expiresAt).toBe("2026-10-01T18:00");
  });

  it("recusa data malformada e tipo desconhecido", () => {
    expect(publicationInputSchema.safeParse({ ...base, publishAt: "01/10/2026" }).success).toBe(false);
    expect(publicationInputSchema.safeParse({ ...base, type: "PROJECT" }).success).toBe(false);
  });

  it("datas do formulário em America/Bahia (UTC−3)", () => {
    expect(fromLocalInput("2026-10-01T18:00").toISOString()).toBe("2026-10-01T21:00:00.000Z");
    expect(toLocalInput(new Date("2026-10-01T21:00:00Z"))).toBe("2026-10-01T18:00");
  });
});
