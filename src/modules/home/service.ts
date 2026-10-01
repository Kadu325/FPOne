import type { PrismaClient } from "@/generated/prisma/client";
import { demoHomeData } from "@/mocks/home/fixtures";
import { loadAudienceSubject } from "@/server/authz/audience";
import { listDocuments } from "@/server/documents/documents";
import { listEventsToday } from "@/server/events/events";
import { isInternalLink } from "@/modules/links/url";
import { listLinksForUser } from "@/server/links/links";
import { upcomingBirthdays as loadBirthdays } from "@/server/people/directory";
import { listFeed, listPendingAcknowledgements, type FeedItem } from "@/server/publications/feed";
import { BIRTHDAY_WINDOW_DAYS, limitBanners, sortAnnouncements, upcomingBirthdays } from "./meu-dia";
import type { HomeAnnouncement, HomeData, HomeNews } from "./types";

export const EMPTY_HOME: HomeData = { announcements: [], eventsToday: [], birthdays: [], links: [], banners: [], news: [], documents: [] };

const HOME_ANNOUNCEMENTS = 5;
const HOME_NEWS = 3;
const HOME_LINKS = 6;
const HOME_DOCUMENTS = 3;
/** Documento "Novo" por 7 dias após a versão vigente. */
const NEW_DOCUMENT_MS = 7 * 86_400_000;

function toAnnouncement(i: FeedItem): HomeAnnouncement {
  return { id: i.id, title: i.title, summary: i.summary, category: i.category ?? "Comunicado", publishedAt: i.publishedAt, pinned: i.pinned, pendingAcknowledgement: i.pendingAcknowledgement };
}

function toNews(i: FeedItem): HomeNews {
  return { id: i.id, title: i.title, summary: i.summary, category: i.category ?? "Novidade", publishedAt: i.publishedAt };
}

/**
 * Dados da Home (RN-HOME-001). Fora do modo demo, Comunicados e Novidades vêm do banco já
 * filtrados por audiência e vigência; os demais blocos ficam vazios até seus módulos (Fase 6),
 * mostrando o estado vazio (RN-HOME-006), nunca número inventado.
 */
export async function getHomeData(opts: { demo: boolean; now: Date; prisma: PrismaClient; userId: string }): Promise<HomeData> {
  const raw = opts.demo ? demoHomeData(opts.now) : await loadReal(opts.prisma, opts.userId, opts.now);
  return {
    ...raw,
    announcements: sortAnnouncements(raw.announcements),
    birthdays: upcomingBirthdays(raw.birthdays, opts.now),
    banners: limitBanners(raw.banners),
  };
}

async function loadReal(prisma: PrismaClient, userId: string, now: Date): Promise<HomeData> {
  const subject = await loadAudienceSubject(prisma, userId);
  if (!subject) return EMPTY_HOME;
  const [announcements, pending, news, birthdays, links, events, documents] = await Promise.all([
    listFeed(prisma, subject, { type: "ANNOUNCEMENT", now, limit: HOME_ANNOUNCEMENTS }),
    listPendingAcknowledgements(prisma, subject, now),
    listFeed(prisma, subject, { type: "NEWS", now, limit: HOME_NEWS }),
    loadBirthdays(prisma, now, BIRTHDAY_WINDOW_DAYS),
    listLinksForUser(prisma, subject, HOME_LINKS),
    listEventsToday(prisma, subject, now),
    listDocuments(prisma, subject, { limit: HOME_DOCUMENTS }),
  ]);
  // Pendências de ciência sempre entram, mesmo fora dos 5 mais recentes (RN-ACK-001).
  const merged = [...pending, ...announcements.filter((a) => !pending.some((p) => p.id === a.id))];
  return {
    ...EMPTY_HOME,
    announcements: merged.map(toAnnouncement),
    news: news.map(toNews),
    birthdays: birthdays.map((b) => ({ id: b.id, name: b.name, department: b.department, unit: b.unit, day: b.day, month: b.month })),
    links: links.map((l) => ({ id: l.id, label: l.label, description: l.description, href: `/api/links/${l.id}`, external: !isInternalLink(l.url) })),
    eventsToday: events.map((e) => ({ id: e.id, title: e.title, location: e.location, startsAt: e.startAt })),
    documents: documents.map((d) => ({
      id: d.id,
      title: d.title,
      area: d.category,
      version: String(d.version),
      updatedAt: d.updatedAt,
      isNew: now.getTime() - d.updatedAt.getTime() < NEW_DOCUMENT_MS,
    })),
  };
}
