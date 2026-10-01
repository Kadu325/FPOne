/**
 * Validação de arquivo de documento (RN-DOC-008, §72): extensão na lista, tamanho máximo e tipo
 * detectado pelos primeiros bytes. Nunca confiar no MIME ou no nome enviados pelo navegador.
 */

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

interface Kind {
  ext: string;
  mime: string;
  /** Assinatura esperada no início do arquivo. */
  magic: "pdf" | "zip" | "png" | "jpeg";
}

const KINDS: readonly Kind[] = [
  { ext: "pdf", mime: "application/pdf", magic: "pdf" },
  { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", magic: "zip" },
  { ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", magic: "zip" },
  { ext: "pptx", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation", magic: "zip" },
  { ext: "png", mime: "image/png", magic: "png" },
  { ext: "jpg", mime: "image/jpeg", magic: "jpeg" },
  { ext: "jpeg", mime: "image/jpeg", magic: "jpeg" },
];

export const ACCEPTED_EXTENSIONS = KINDS.map((k) => `.${k.ext}`).join(",");

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((b, i) => bytes[i] === b);
}

function matchesMagic(bytes: Uint8Array, magic: Kind["magic"]): boolean {
  switch (magic) {
    case "pdf":
      return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
    case "zip":
      return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04 (OOXML)
    case "png":
      return startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpeg":
      return startsWith(bytes, [0xff, 0xd8, 0xff]);
  }
}

export type FileCheck = { ok: true; ext: string; mime: string; fileName: string } | { ok: false; reason: "empty" | "too_large" | "extension" | "content" };

/** Nome exibido no download: sem caminho, sem caracteres de controle, até 150 caracteres. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "arquivo";
  const cleaned = base
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f"<>|:*?]/g, "")
    .trim();
  return (cleaned || "arquivo").slice(-150);
}

export function checkDocumentFile(name: string, size: number, head: Uint8Array): FileCheck {
  if (size === 0) return { ok: false, reason: "empty" };
  if (size > MAX_DOCUMENT_BYTES) return { ok: false, reason: "too_large" };
  const ext = safeFileName(name).split(".").pop()?.toLowerCase() ?? "";
  const kind = KINDS.find((k) => k.ext === ext);
  if (!kind) return { ok: false, reason: "extension" };
  if (!matchesMagic(head, kind.magic)) return { ok: false, reason: "content" };
  return { ok: true, ext: kind.ext, mime: kind.mime, fileName: safeFileName(name) };
}

export const FILE_ERRORS: Record<Exclude<FileCheck, { ok: true }>["reason"], string> = {
  empty: "O arquivo está vazio.",
  too_large: "O arquivo passa de 20 MB.",
  extension: "Tipo não permitido. Use PDF, DOCX, XLSX, PPTX, PNG ou JPG.",
  content: "O conteúdo do arquivo não corresponde à extensão.",
};

/** Categorias do §14. */
export const DOCUMENT_CATEGORIES = ["Políticas", "Procedimentos", "POPs", "Normas", "Manuais", "Formulários", "Documentos corporativos"] as const;
