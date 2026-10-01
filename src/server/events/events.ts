import type { PrismaClient } from "@/generated/prisma/client";
import type { EventStatus } from "@/generated/prisma/enums";
import { audienceFilter, type AudienceSubject } from "@/server/authz/audience";
import { dayBounds, effectiveEventStatus } from "./rules";

export interface EventItem {
  id: string;
  title: string;
  description: string;
  location: string;
  startAt: Date;
  endAt: Date;
  status: EventStatus;
  cancelReason: string | null;
}

const select = { id: true, title: true, description: true, location: true, startAt: true, endAt: true, status: true, cancelReason: true } as const;

export async function listAgenda(prisma: PrismaClient, subject: AudienceSubject, now: Date, pastDays = 30): Promise<{ upcoming: EventItem[]; past: EventItem[] }> {
  const since = new Date(dayBounds(now).start.getTime() - pastDays * 86_400_000);
  const rows = await prisma.event.findMany({
    where: { AND: [{ status: { in: ["PUBLISHED", "CANCELLED"] }, endAt: { gte: since } }, audienceFilter(subject)] },
    select,
    orderBy: { startAt: "asc" },
    take: 300,
  });
  const items = rows.map((r) => ({ ...r, status: effectiveEventStatus(r, now) }));
  return {
    upcoming: items.filter((e) => e.endAt >= now),
    past: items.filter((e) => e.endAt < now).reverse(),
  };
}

export async function listEventsToday(prisma: PrismaClient, subject: AudienceSubject, now: Date): Promise<EventItem[]> {
  const { start, end } = dayBounds(now);
  return prisma.event.findMany({
    where: { AND: [{ status: "PUBLISHED", startAt: { lt: end }, endAt: { gte: start } }, audienceFilter(subject)] },
    select,
    orderBy: { startAt: "asc" },
    take: 20,
  });
}

export async function searchEvents(prisma: PrismaClient, subject: AudienceSubject, ids: string[], now: Date): Promise<EventItem[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.event.findMany({
    where: { AND: [{ id: { in: ids }, status: { in: ["PUBLISHED", "CANCELLED"] } }, audienceFilter(subject)] },
    select,
  });
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.map((r) => ({ ...r, status: effectiveEventStatus(r, now) })).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}
