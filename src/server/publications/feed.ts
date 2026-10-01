import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type { PublicationType } from "@/generated/prisma/enums";
import { BusinessError } from "@/lib/errors";
import { parseStoredDoc, type RichDoc } from "@/modules/publications/content";
import { audit } from "@/server/audit/audit";
import { audienceFilter, type AudienceSubject } from "@/server/authz/audience";
import { hasValidAcknowledgement, visibleWhere } from "./rules";

/**
 * Lado do colaborador (§78): só publicações vigentes e do público do usuário (RN-CORE-002,
 * RN-COM-005/006). Toda consulta aqui usa audienceFilter; a guarda de testes confere.
 */

export interface FeedItem {
  id: string;
  type: PublicationType;
  title: string;
  summary: string;
  category: string | null;
  categoryId: string | null;
  pinned: boolean;
  isFeatured: boolean;
  requiresAcknowledgement: boolean;
  /** Exige ciência e o usuário ainda não confirmou a versão atual. */
  pendingAcknowledgement: boolean;
  publishedAt: Date;
}

export interface FeedDetail extends FeedItem {
  content: RichDoc;
  acknowledgedAt: Date | null;
}

const feedSelect = (userId: string) =>
  ({
    id: true,
    type: true,
    title: true,
    summary: true,
    content: true,
    categoryId: true,
    category: { select: { name: true } },
    pinned: true,
    isFeatured: true,
    requiresAcknowledgement: true,
    version: true,
    publishAt: true,
    reads: { where: { userId }, select: { acknowledgedVersion: true, acknowledgedAt: true } },
  }) satisfies Prisma.PublicationSelect;

type Row = Prisma.PublicationGetPayload<{ select: ReturnType<typeof feedSelect> }>;

function toItem(row: Row): FeedItem {
  const read = row.reads[0];
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    summary: row.summary,
    category: row.category?.name ?? null,
    categoryId: row.categoryId,
    pinned: row.pinned,
    isFeatured: row.isFeatured,
    requiresAcknowledgement: row.requiresAcknowledgement,
    pendingAcknowledgement: row.requiresAcknowledgement && !hasValidAcknowledgement(read, row.version),
    publishedAt: row.publishAt ?? new Date(0),
  };
}

export async function listFeed(
  prisma: PrismaClient,
  subject: AudienceSubject,
  opts: { type: PublicationType; now: Date; categoryId?: string; limit?: number },
): Promise<FeedItem[]> {
  const rows = await prisma.publication.findMany({
    where: { AND: [{ type: opts.type }, visibleWhere(opts.now), audienceFilter(subject), opts.categoryId ? { categoryId: opts.categoryId } : {}] },
    select: feedSelect(subject.userId),
    orderBy: [{ pinned: "desc" }, { publishAt: "desc" }],
    take: opts.limit ?? 50,
  });
  return rows.map(toItem);
}

/** Para a busca global: mesmos filtros de vigência e audiência, só os ids já ranqueados. */
export async function publicationsByIds(prisma: PrismaClient, subject: AudienceSubject, ids: string[], now: Date): Promise<FeedItem[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.publication.findMany({
    where: { AND: [{ id: { in: ids } }, visibleWhere(now), audienceFilter(subject)] },
    select: feedSelect(subject.userId),
  });
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.map(toItem).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** Comunicados com ciência pendente para o Meu Dia (RN-HOME-002, RN-ACK-001/004/005). */
export async function listPendingAcknowledgements(prisma: PrismaClient, subject: AudienceSubject, now: Date): Promise<FeedItem[]> {
  const rows = await prisma.publication.findMany({
    where: { AND: [{ type: "ANNOUNCEMENT", requiresAcknowledgement: true }, visibleWhere(now), audienceFilter(subject)] },
    select: feedSelect(subject.userId),
    orderBy: { publishAt: "desc" },
    take: 20,
  });
  return rows.map(toItem).filter((i) => i.pendingAcknowledgement);
}

async function findVisible(prisma: Pick<PrismaClient, "publication">, subject: AudienceSubject, id: string, now: Date): Promise<Row> {
  const row = await prisma.publication.findFirst({
    where: { AND: [{ id }, visibleWhere(now), audienceFilter(subject)] },
    select: feedSelect(subject.userId),
  });
  // Fora do público, fora da vigência ou inexistente: mesma resposta (não revela existência).
  if (!row) throw new BusinessError("ERR_NOT_FOUND");
  return row;
}

export async function getFeedDetail(prisma: PrismaClient, subject: AudienceSubject, id: string, now: Date): Promise<FeedDetail> {
  const row = await findVisible(prisma, subject, id, now);
  const item = toItem(row);
  const read = row.reads[0];
  return {
    ...item,
    content: parseStoredDoc(row.content),
    acknowledgedAt: item.pendingAcknowledgement ? null : (read?.acknowledgedAt ?? null),
  };
}

/** Primeira visualização cria o registro; as seguintes só incrementam (RN-COM-015). */
export async function registerView(prisma: PrismaClient, subject: AudienceSubject, id: string, now: Date): Promise<void> {
  await findVisible(prisma, subject, id, now);
  await prisma.publicationRead.upsert({
    where: { publicationId_userId: { publicationId: id, userId: subject.userId } },
    create: { publicationId: id, userId: subject.userId, firstViewedAt: now, lastViewedAt: now },
    update: { lastViewedAt: now, viewCount: { increment: 1 } },
  });
}

/**
 * "Li e estou ciente" (§10, RN-ACK-001..003/006). Timestamp do servidor; confirmar de novo a
 * mesma versão não duplica nada. Uma nova versão material pede nova confirmação.
 */
export async function acknowledge(prisma: PrismaClient, subject: AudienceSubject, id: string, now: Date, ip: string | null): Promise<{ alreadyAcknowledged: boolean }> {
  return prisma.$transaction(async (tx) => {
    const row = await findVisible(tx, subject, id, now);
    if (!row.requiresAcknowledgement) throw new BusinessError("ERR_ACK_NOT_REQUIRED");
    if (hasValidAcknowledgement(row.reads[0], row.version)) return { alreadyAcknowledged: true };
    await tx.publicationRead.upsert({
      where: { publicationId_userId: { publicationId: id, userId: subject.userId } },
      create: { publicationId: id, userId: subject.userId, firstViewedAt: now, lastViewedAt: now, acknowledgedAt: now, acknowledgedVersion: row.version },
      update: { acknowledgedAt: now, acknowledgedVersion: row.version },
    });
    await audit(tx, { actorId: subject.userId, action: "PUBLICATION_ACKNOWLEDGED", entity: "publication", entityId: id, metadata: { version: row.version }, ip });
    return { alreadyAcknowledged: false };
  });
}
