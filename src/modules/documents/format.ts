import { APP_LOCALE, APP_TIMEZONE } from "@/lib/constants";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat(APP_LOCALE, { timeZone: APP_TIMEZONE, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

/** yyyy-mm-dd no fuso corporativo, para <input type="date">. */
export function toDateInput(date: Date | null): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/** Rótulo curto do tipo, a partir do MIME detectado no upload. */
export function fileKind(mime: string | null): string {
  if (!mime) return "Arquivo";
  if (mime === "application/pdf") return "PDF";
  if (mime.includes("wordprocessingml")) return "DOCX";
  if (mime.includes("spreadsheetml")) return "XLSX";
  if (mime.includes("presentationml")) return "PPTX";
  if (mime === "image/png") return "PNG";
  if (mime === "image/jpeg") return "JPG";
  return "Arquivo";
}
