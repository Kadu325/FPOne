import { daysUntilBirthday, isSameDay } from "./time";
import type { HomeAnnouncement, HomeBanner, HomeBirthday, HomeData, MeuDiaItem } from "./types";

export const MEU_DIA_MAX = 3;
/** RN-HOME-005: no máximo 3 banners ativos por usuário. */
export const BANNERS_MAX = 3;
/** Janela de aniversariantes exibida na Home. */
export const BIRTHDAY_WINDOW_DAYS = 7;

/**
 * Meu Dia (§11, RN-HOME-003), na ordem da RN-HOME-002: ciência pendente, eventos de hoje,
 * documentos novos. Sem módulo de tarefas no MVP (§185). Máximo de 3 itens.
 */
export function buildMeuDia(data: HomeData, now: Date): MeuDiaItem[] {
  const items: MeuDiaItem[] = [];
  for (const a of data.announcements.filter((x) => x.pendingAcknowledgement)) {
    items.push({ kind: "acknowledgement", id: a.id, title: a.title });
  }
  const events = data.eventsToday.filter((e) => isSameDay(e.startsAt, now) && e.startsAt >= now).sort((x, y) => x.startsAt.getTime() - y.startsAt.getTime());
  for (const e of events) items.push({ kind: "event", id: e.id, title: e.title, location: e.location, startsAt: e.startsAt });
  const newDocs = data.documents.filter((d) => d.isNew);
  if (newDocs.length > 0) items.push({ kind: "documents", count: newDocs.length, titles: newDocs.map((d) => d.title) });
  return items.slice(0, MEU_DIA_MAX);
}

/** Obrigatórios pendentes primeiro, depois fixados, depois os mais recentes (RN-HOME-002). */
export function sortAnnouncements(list: readonly HomeAnnouncement[]): HomeAnnouncement[] {
  const rank = (a: HomeAnnouncement) => (a.pendingAcknowledgement ? 0 : a.pinned ? 1 : 2);
  return [...list].sort((x, y) => rank(x) - rank(y) || y.publishedAt.getTime() - x.publishedAt.getTime());
}

export function upcomingBirthdays(list: readonly HomeBirthday[], now: Date): HomeBirthday[] {
  return list
    .map((b) => ({ b, days: daysUntilBirthday(b.day, b.month, now) }))
    .filter((x) => x.days < BIRTHDAY_WINDOW_DAYS)
    .sort((x, y) => x.days - y.days || x.b.name.localeCompare(y.b.name, "pt-BR"))
    .map((x) => x.b);
}

export function limitBanners(list: readonly HomeBanner[]): HomeBanner[] {
  return list.slice(0, BANNERS_MAX);
}
