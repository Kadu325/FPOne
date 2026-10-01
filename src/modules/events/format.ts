import { APP_LOCALE, APP_TIMEZONE } from "@/lib/constants";
import { isSameDay } from "@/modules/home/time";

const dayFmt = new Intl.DateTimeFormat(APP_LOCALE, { timeZone: APP_TIMEZONE, weekday: "short", day: "2-digit", month: "2-digit" });
const timeFmt = new Intl.DateTimeFormat(APP_LOCALE, { timeZone: APP_TIMEZONE, hour: "2-digit", minute: "2-digit" });

/** Ex.: "ter., 29/09 · 14:30–16:00" ou, em dias diferentes, "ter., 29/09 14:30 → qua., 30/09 12:00". */
export function formatEventRange(start: Date, end: Date): string {
  if (isSameDay(start, end)) return `${dayFmt.format(start)} · ${timeFmt.format(start)}–${timeFmt.format(end)}`;
  return `${dayFmt.format(start)} ${timeFmt.format(start)} → ${dayFmt.format(end)} ${timeFmt.format(end)}`;
}

/** Rótulo do dia para agrupar a agenda: "Hoje", "Amanhã" ou "quinta-feira, 01/10". */
export function agendaDayLabel(date: Date, now: Date): string {
  if (isSameDay(date, now)) return "Hoje";
  if (isSameDay(date, new Date(now.getTime() + 86_400_000))) return "Amanhã";
  return new Intl.DateTimeFormat(APP_LOCALE, { timeZone: APP_TIMEZONE, weekday: "long", day: "2-digit", month: "2-digit" }).format(date);
}
