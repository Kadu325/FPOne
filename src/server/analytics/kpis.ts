import type { PrismaClient } from "@/generated/prisma/client";
import { periodWindow, rate, type PeriodDays, type PeriodWindow } from "@/modules/analytics/kpi";
import { assertCan, type Actor } from "@/server/authz/can";
import { metricsFor } from "@/server/publications/admin";

/**
 * Indicadores (§43, §164, §187). Só valores de consulta real; ausência de dado vira null e a tela
 * mostra "Ainda não há dados suficientes" (RN-KPI-007). Só agregados, nunca por pessoa (RN-KPI-006).
 */

export interface KpiReport {
  window: PeriodWindow;
  population: number;
  collectingSince: Date | null;
  activity: { periodActive: number; dau: number; wau: number; mau: number; activeRate: number | null; returnRate: number | null } | null;
  publications: { published: number; views: number; recipients: number; viewed: number; readRate: number | null; ackRecipients: number; acknowledged: number; ackRate: number | null };
  documents: { downloads: number; distinctDocuments: number };
  searches: { total: number; withoutResults: number; withoutResultsRate: number | null };
  links: { clicks: number; top: { label: string; clicks: number }[] };
}

const DAY = 86_400_000;
const MAX_PUBLICATIONS = 200;

async function distinctActive(prisma: PrismaClient, from: Date, to: Date): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(DISTINCT user_id) AS n FROM "user_activity_day" WHERE day >= ${from}::date AND day <= ${to}::date`;
  return Number(rows[0]?.n ?? 0);
}

async function returning(prisma: PrismaClient, w: PeriodWindow): Promise<{ previous: number; returned: number }> {
  const prevEnd = new Date(w.startDay.getTime() - DAY);
  const rows = await prisma.$queryRaw<{ previous: bigint; returned: bigint }[]>`
    WITH prev AS (SELECT DISTINCT user_id FROM "user_activity_day" WHERE day >= ${w.previousStartDay}::date AND day <= ${prevEnd}::date),
         cur AS (SELECT DISTINCT user_id FROM "user_activity_day" WHERE day >= ${w.startDay}::date AND day <= ${w.endDay}::date)
    SELECT (SELECT COUNT(*) FROM prev) AS previous, (SELECT COUNT(*) FROM prev WHERE user_id IN (SELECT user_id FROM cur)) AS returned`;
  return { previous: Number(rows[0]?.previous ?? 0), returned: Number(rows[0]?.returned ?? 0) };
}

export async function kpiReport(prisma: PrismaClient, actor: Actor | null, days: PeriodDays, now: Date): Promise<KpiReport> {
  assertCan(actor, "analytics.read");
  const w = periodWindow(now, days);
  const inPeriod = { gte: w.startAt, lte: w.endAt };

  const [population, first, pubs, views, downloads, docGroups, searches, emptySearches, clicks, topClicks] = await Promise.all([
    prisma.user.count({ where: { employee: { status: "ACTIVE" } } }),
    prisma.userActivityDay.findFirst({ orderBy: { day: "asc" }, select: { day: true } }),
    prisma.publication.findMany({
      where: { publishedAt: inPeriod, status: { in: ["PUBLISHED", "EXPIRED", "ARCHIVED"] } },
      select: { id: true, version: true, requiresAcknowledgement: true, audiences: true },
      orderBy: { publishedAt: "desc" },
      take: MAX_PUBLICATIONS,
    }),
    prisma.publicationRead.count({ where: { firstViewedAt: inPeriod } }),
    prisma.auditLog.count({ where: { action: "DOCUMENT_DOWNLOADED", createdAt: inPeriod } }),
    prisma.auditLog.groupBy({ by: ["entityId"], where: { action: "DOCUMENT_DOWNLOADED", createdAt: inPeriod } }),
    prisma.searchEvent.count({ where: { createdAt: inPeriod } }),
    prisma.searchEvent.count({ where: { createdAt: inPeriod, resultCount: 0 } }),
    prisma.linkClick.count({ where: { createdAt: inPeriod } }),
    prisma.linkClick.groupBy({ by: ["linkId"], where: { createdAt: inPeriod }, _count: { _all: true }, orderBy: { _count: { linkId: "desc" } }, take: 5 }),
  ]);

  let activity: KpiReport["activity"] = null;
  if (first) {
    const today = w.endDay;
    const [periodActive, dau, wau, mau, ret] = await Promise.all([
      distinctActive(prisma, w.startDay, today),
      distinctActive(prisma, today, today),
      distinctActive(prisma, new Date(today.getTime() - 6 * DAY), today),
      distinctActive(prisma, new Date(today.getTime() - 29 * DAY), today),
      returning(prisma, w),
    ]);
    activity = { periodActive, dau, wau, mau, activeRate: rate(periodActive, population), returnRate: rate(ret.returned, ret.previous) };
  }

  const metrics = await Promise.all(pubs.map((p) => metricsFor(prisma, p)));
  const sum = (f: (i: number) => number) => metrics.reduce((acc, _m, i) => acc + f(i), 0);
  const recipients = sum((i) => metrics[i]?.recipients ?? 0);
  const viewed = sum((i) => metrics[i]?.viewed ?? 0);
  const ackIdx = pubs.map((p, i) => (p.requiresAcknowledgement ? i : -1)).filter((i) => i >= 0);
  const ackRecipients = ackIdx.reduce((acc, i) => acc + (metrics[i]?.recipients ?? 0), 0);
  const acknowledged = ackIdx.reduce((acc, i) => acc + (metrics[i]?.acknowledged ?? 0), 0);

  const labels = await prisma.usefulLink.findMany({ where: { id: { in: topClicks.map((t) => t.linkId) } }, select: { id: true, label: true } });
  const labelOf = new Map(labels.map((l) => [l.id, l.label]));

  return {
    window: w,
    population,
    collectingSince: first?.day ?? null,
    activity,
    publications: {
      published: pubs.length,
      views,
      recipients,
      viewed,
      readRate: rate(viewed, recipients),
      ackRecipients,
      acknowledged,
      ackRate: rate(acknowledged, ackRecipients),
    },
    documents: { downloads, distinctDocuments: docGroups.length },
    searches: { total: searches, withoutResults: emptySearches, withoutResultsRate: rate(emptySearches, searches) },
    links: { clicks, top: topClicks.map((t) => ({ label: labelOf.get(t.linkId) ?? "Link removido", clicks: t._count._all })) },
  };
}
