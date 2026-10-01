import { APP_LOCALE } from "@/lib/constants";
import { zonedParts } from "@/modules/home/time";

/** Períodos aceitos na tela de Indicadores (RN-KPI-004: período sempre explícito). */
export const PERIODS = [7, 30, 90] as const;
export type PeriodDays = (typeof PERIODS)[number];

export function parsePeriod(value: string | undefined): PeriodDays {
  const n = Number(value);
  return (PERIODS as readonly number[]).includes(n) ? (n as PeriodDays) : 30;
}

export interface PeriodWindow {
  days: PeriodDays;
  /** Primeiro dia (DATE, meia-noite UTC do dia local), inclusive. */
  startDay: Date;
  /** Hoje (DATE), inclusive. */
  endDay: Date;
  /** Instante inicial em UTC (00:00 de startDay na Bahia). */
  startAt: Date;
  endAt: Date;
  /** Janela anterior de mesmo tamanho, para taxa de retorno. */
  previousStartDay: Date;
}

const DAY = 86_400_000;
/** America/Bahia é UTC−3 fixo. */
const BAHIA_OFFSET_MS = 3 * 3_600_000;

/** Janela de N dias terminando hoje, no fuso corporativo (RN-CORE-003). */
export function periodWindow(now: Date, days: PeriodDays): PeriodWindow {
  const { year, month, day } = zonedParts(now);
  const endDay = new Date(Date.UTC(year, month - 1, day));
  const startDay = new Date(endDay.getTime() - (days - 1) * DAY);
  return {
    days,
    startDay,
    endDay,
    startAt: new Date(startDay.getTime() + BAHIA_OFFSET_MS),
    endAt: now,
    previousStartDay: new Date(startDay.getTime() - days * DAY),
  };
}

/** Taxa inteira em %; sem denominador, null ("sem dados suficientes", RN-KPI-007). */
export function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

export function formatPeriod(w: PeriodWindow): string {
  const f = new Intl.DateTimeFormat(APP_LOCALE, { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
  return `${f.format(w.startDay)} a ${f.format(w.endDay)}`;
}

export function formatDay(day: Date): string {
  return new Intl.DateTimeFormat(APP_LOCALE, { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" }).format(day);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat(APP_LOCALE).format(n);
}
