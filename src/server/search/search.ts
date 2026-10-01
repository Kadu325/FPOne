import type { PrismaClient } from "@/generated/prisma/client";
import { likeEscape, MIN_QUERY_LENGTH, normalizeQuery } from "@/modules/search/normalize";
import { loadAudienceSubject } from "@/server/authz/audience";
import type { Actor } from "@/server/authz/can";
import { documentsByIds, type DocumentItem } from "@/server/documents/documents";
import { searchEvents, type EventItem } from "@/server/events/events";
import { searchPeople, type PersonCard } from "@/server/people/directory";
import { publicationsByIds, type FeedItem } from "@/server/publications/feed";

/**
 * Busca Global (§15, §101, §163). Pesquisa tradicional, sem IA: normaliza a consulta (RN-SRC-005/006),
 * ranqueia ids por SQL (RN-SRC-004) e SEMPRE lê o resultado final pelos repositórios com
 * audienceFilter e vigência (RN-SRC-002). O SQL daqui nunca devolve conteúdo, só ids candidatos.
 * A interface é única para poder trocar o motor (embeddings/RAG) no futuro sem mudar quem chama.
 */

export interface SearchResults {
  term: string;
  tooShort: boolean;
  people: PersonCard[];
  publications: FeedItem[];
  documents: DocumentItem[];
  events: EventItem[];
}

const PER_DOMAIN = 8;

async function rankedPublicationIds(prisma: PrismaClient, term: string): Promise<string[]> {
  const p = `%${likeEscape(term)}%`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "publication"
    WHERE status IN ('PUBLISHED', 'SCHEDULED')
      AND (unaccent(lower(title)) LIKE ${p} OR unaccent(lower(summary)) LIKE ${p})
    ORDER BY CASE WHEN unaccent(lower(title)) = ${term} THEN 0 WHEN unaccent(lower(title)) LIKE ${p} THEN 1 ELSE 2 END, publish_at DESC
    LIMIT 50`;
  return rows.map((r) => r.id);
}

async function rankedDocumentIds(prisma: PrismaClient, term: string): Promise<string[]> {
  const p = `%${likeEscape(term)}%`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT d.id FROM "document" d
    WHERE d.status = 'PUBLISHED'
      AND (unaccent(lower(d.title)) LIKE ${p} OR unaccent(lower(d.description)) LIKE ${p} OR unaccent(lower(d.category)) LIKE ${p})
    ORDER BY CASE WHEN unaccent(lower(d.title)) = ${term} THEN 0 WHEN unaccent(lower(d.title)) LIKE ${p} THEN 1 ELSE 2 END, d.updated_at DESC
    LIMIT 50`;
  return rows.map((r) => r.id);
}

async function rankedEventIds(prisma: PrismaClient, term: string, now: Date): Promise<string[]> {
  const p = `%${likeEscape(term)}%`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT id FROM "event"
    WHERE status IN ('PUBLISHED', 'CANCELLED') AND end_at >= ${now}
      AND (unaccent(lower(title)) LIKE ${p} OR unaccent(lower(location)) LIKE ${p} OR unaccent(lower(description)) LIKE ${p})
    ORDER BY CASE WHEN unaccent(lower(title)) LIKE ${p} THEN 0 ELSE 1 END, start_at ASC
    LIMIT 50`;
  return rows.map((r) => r.id);
}

export async function globalSearch(prisma: PrismaClient, actor: Actor, rawQuery: string, now: Date): Promise<SearchResults> {
  const term = normalizeQuery(rawQuery.slice(0, 200));
  const empty = { people: [], publications: [], documents: [], events: [] };
  if (term.length < MIN_QUERY_LENGTH) return { term, tooShort: rawQuery.trim().length > 0, ...empty };
  const subject = await loadAudienceSubject(prisma, actor.id);
  if (!subject) return { term, tooShort: false, ...empty };

  const [people, pubIds, docIds, eventIds] = await Promise.all([
    searchPeople(prisma, actor, term, PER_DOMAIN),
    rankedPublicationIds(prisma, term),
    rankedDocumentIds(prisma, term),
    rankedEventIds(prisma, term, now),
  ]);
  const [publications, documents, events] = await Promise.all([
    publicationsByIds(prisma, subject, pubIds, now),
    documentsByIds(prisma, subject, docIds),
    searchEvents(prisma, subject, eventIds, now),
  ]);
  return {
    term,
    tooShort: false,
    people,
    publications: publications.slice(0, PER_DOMAIN),
    documents: documents.slice(0, PER_DOMAIN),
    events: events.slice(0, PER_DOMAIN),
  };
}
