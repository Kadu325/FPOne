import { APP_LOCALE, APP_TIMEZONE } from "@/lib/constants";

/** Partes da data no fuso corporativo (RN-CORE-003). "Hoje" é sempre o de America/Bahia. */
export function zonedParts(date: Date): { year: number; month: number; day: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: APP_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
}

export function greeting(now: Date): string {
  const { hour } = zonedParts(now);
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

/** Ex.: "Terça-feira, 29 de setembro". */
export function longDate(now: Date): string {
  const text = new Intl.DateTimeFormat(APP_LOCALE, { timeZone: APP_TIMEZONE, weekday: "long", day: "numeric", month: "long" }).format(now);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function timeOfDay(date: Date): string {
  return new Intl.DateTimeFormat(APP_LOCALE, { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(date);
}

export function isSameDay(a: Date, b: Date): boolean {
  const x = zonedParts(a);
  const y = zonedParts(b);
  return x.year === y.year && x.month === y.month && x.day === y.day;
}

/** Rótulo curto relativo a hoje: "Hoje", "Ontem" ou "dd/mm". */
export function relativeDay(date: Date, now: Date): string {
  if (isSameDay(date, now)) return "Hoje";
  if (isSameDay(date, new Date(now.getTime() - 86_400_000))) return "Ontem";
  const { day, month } = zonedParts(date);
  return `${pad(day)}/${pad(month)}`;
}

/**
 * Dias até o próximo aniversário (0 = hoje), contado no fuso corporativo.
 * 29/02 em ano não bissexto é comemorado em 28/02.
 */
export function daysUntilBirthday(day: number, month: number, now: Date): number {
  const today = zonedParts(now);
  const base = Date.UTC(today.year, today.month - 1, today.day);
  for (const year of [today.year, today.year + 1]) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    const d = month === 2 && day === 29 && !leap ? 28 : day;
    const diff = Math.round((Date.UTC(year, month - 1, d) - base) / 86_400_000);
    if (diff >= 0) return diff;
  }
  return 365;
}

export function birthdayLabel(day: number, month: number, now: Date): string {
  const days = daysUntilBirthday(day, month, now);
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  return `${pad(day)}/${pad(month)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}
