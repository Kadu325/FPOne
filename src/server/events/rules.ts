import type { EventStatus } from "@/generated/prisma/enums";
import { BusinessError } from "@/lib/errors";
import { zonedParts } from "@/modules/home/time";

const TRANSITIONS: Record<EventStatus, readonly EventStatus[]> = {
  DRAFT: ["SCHEDULED", "PUBLISHED"],
  SCHEDULED: ["DRAFT", "PUBLISHED"],
  PUBLISHED: ["CANCELLED", "FINISHED"],
  CANCELLED: [],
  FINISHED: [],
};

export function assertEventTransition(from: EventStatus, to: EventStatus): void {
  if (!TRANSITIONS[from].includes(to)) throw new BusinessError("ERR_INVALID_TRANSITION");
}

export function effectiveEventStatus(e: { status: EventStatus; endAt: Date }, now: Date): EventStatus {
  return e.status === "PUBLISHED" && e.endAt < now ? "FINISHED" : e.status;
}

export function assertEventDates(startAt: Date, endAt: Date): void {
  if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()) || endAt < startAt) throw new BusinessError("ERR_INVALID_EVENT_DATES");
}

export function dayBounds(now: Date): { start: Date; end: Date } {
  const { year, month, day } = zonedParts(now);
  const start = new Date(Date.UTC(year, month - 1, day, 3, 0, 0, 0));
  return { start, end: new Date(start.getTime() + 86_400_000) };
}
