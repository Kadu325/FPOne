import { describe, expect, it } from "vitest";
import { checkDocumentFile, MAX_DOCUMENT_BYTES, safeFileName } from "./file";
import { fileKind, formatBytes } from "./format";

const bytes = (...b: number[]) => new Uint8Array(b);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31);
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04, 0x14);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0);
const TEXT = new TextEncoder().encode("<script>alert(1)</script>");

describe("validação de arquivo (RN-DOC-008)", () => {
  it("aceita tipos permitidos pelo conteúdo real e devolve o MIME detectado", () => {
    expect(checkDocumentFile("Política.pdf", 1000, PDF)).toMatchObject({ ok: true, ext: "pdf", mime: "application/pdf" });
    expect(checkDocumentFile("POP.DOCX", 1000, ZIP)).toMatchObject({ ok: true, ext: "docx" });
    expect(checkDocumentFile("planilha.xlsx", 1000, ZIP)).toMatchObject({ ok: true, ext: "xlsx" });
    expect(checkDocumentFile("mapa.png", 1000, PNG)).toMatchObject({ ok: true, mime: "image/png" });
    expect(checkDocumentFile("foto.jpeg", 1000, JPG)).toMatchObject({ ok: true, mime: "image/jpeg" });
  });

  it("recusa extensão executável ou fora da lista", () => {
    for (const name of ["virus.exe", "script.js", "pagina.html", "arquivo", "macro.docm", "imagem.svg"]) {
      expect(checkDocumentFile(name, 10, PDF)).toEqual({ ok: false, reason: "extension" });
    }
  });

  it("recusa conteúdo que não bate com a extensão", () => {
    expect(checkDocumentFile("falso.pdf", TEXT.length, TEXT)).toEqual({ ok: false, reason: "content" });
    expect(checkDocumentFile("falso.docx", 10, PDF)).toEqual({ ok: false, reason: "content" });
  });

  it("recusa vazio e acima de 20 MB", () => {
    expect(checkDocumentFile("a.pdf", 0, PDF)).toEqual({ ok: false, reason: "empty" });
    expect(checkDocumentFile("a.pdf", MAX_DOCUMENT_BYTES + 1, PDF)).toEqual({ ok: false, reason: "too_large" });
    expect(checkDocumentFile("a.pdf", MAX_DOCUMENT_BYTES, PDF).ok).toBe(true);
  });

  it("nome seguro: sem caminho nem caracteres de controle", () => {
    expect(safeFileName("C:\\Users\\x\\..\\Política de Compras.pdf")).toBe("Política de Compras.pdf");
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName('a"b<c>|d.pdf')).toBe("abcd.pdf");
    expect(safeFileName("")).toBe("arquivo");
  });

  it("formatos de exibição", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3.5 * 1024 * 1024)).toBe("3,5 MB");
    expect(fileKind("application/pdf")).toBe("PDF");
    expect(fileKind(null)).toBe("Arquivo");
  });
});
