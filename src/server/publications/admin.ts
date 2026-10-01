import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import type { PublicationStatus, PublicationType } from "@/generated/prisma/enums";
import { BusinessError } from "@/lib/errors";
import { parseStoredDoc, type RichDoc } from "@/modules/publications/content";
import { fromLocalInput, type ParsedPublicationInput } from "@/modules/publications/schema";
import { audit } from "@/server/audit/audit";
import { assertCan, can, type Actor } from "@/server/authz/can";
import {
  assertPublishable,
  assertTransition,
  assertTypeRules,
  computeMetrics,
  effectiveStatus,
  recipientsWhere,
  type PublicationDraft,
  type PublicationMetrics,
} from "./rules";

/**
 * FPOne Admin › Publicações (§60–81). Exceção da RN-CORE-002: quem gerencia conteúdo vê todas
 * as publicações, sem audienceFilter, e só com permissão explícita (checada em cada função).
 * Este arquivo está na lista ALLOWED da guarda de audiência por esse motivo.
 */

type Tx = Prisma.TransactionClient;

/** Materializa agendamento e expiração vencidos (a visibilidade já é calculada na leitura). */
export async function syncStatuses(prisma: PrismaClient, now: Date): Promise<void> {
  await prisma.$executeRaw`UPDATE "publication" SET "status" = 'PUBLISHED', "published_at" = "publish_at", "updated_at" = ${now}
    WHERE "status" = 'SCHEDULED' AND "publish_at" <= ${now}`;
  await prisma.$executeRaw`UPDATE "publication" SET "status" = 'EXPIRED', "updated_at" = ${now}
    WHERE "status" = 'PUBLISHED' AND "expires_at" IS NOT NULL AND "expires_at" <= ${now}`;
}

export interface AdminListFilter {
  status?: PublicationStatus;
  type?: PublicationType;
  q?: string;
}

export interface AdminListItem {
  id: string;
  type: PublicationType;
  title: string;
  category: string | null;
  author: string;
  status: PublicationStatus;
  audience: string;
  publishAt: Date | null;
  requiresAcknowledgement: boolean;
  metrics: PublicationMetrics | null;
}

function audienceLabel(list: readonly { audienceType: string; audienceId: string | null }[]): string {
  if (list.length === 0) return "Sem público";
  if (list.some((a) => a.audienceType === "ALL")) return "Toda a empresa";
  const names: Record<string, string> = { UNIT: "Unidade", DEPARTMENT: "Departamento", GROUP: "Grupo", USER: "Usuário" };
  return list.map((a) => (a.audienceType === "USER" ? "Usuário específico" : `${names[a.audienceType]}: ${a.audienceId}`)).join(" · ");
}

export async function metricsFor(prisma: PrismaClient | Tx, p: { id: string; version: number; requiresAcknowledgement: boolean; audiences: { audienceType: never | string; audienceId: string | null }[] }): Promise<PublicationMetrics> {
  const who = recipientsWhere(p.audiences as Parameters<typeof recipientsWhere>[0]);
  const [recipients, viewed, acknowledged] = await Promise.all([
    prisma.user.count({ where: who }),
    prisma.publicationRead.count({ where: { publicationId: p.id, user: who } }),
    prisma.publicationRead.count({ where: { publicationId: p.id, acknowledgedVersion: p.version, user: who } }),
  ]);
  return computeMetrics(recipients, viewed, acknowledged, p.requiresAcknowledgement);
}

const LIST_LIMIT = 50;

export async function listForAdmin(prisma: PrismaClient, actor: Actor, filter: AdminListFilter, now: Date): Promise<AdminListItem[]> {
  assertCan(actor, "publication.create");
  await syncStatuses(prisma, now);
  const q = filter.q?.trim();
  const rows = await prisma.publication.findMany({
    where: {
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.type ? { type: filter.type } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { author: { employee: { name: { contains: q, mode: "insensitive" } } } },
              { category: { name: { contains: q, mode: "insensitive" } } },
              { audiences: { some: { audienceId: { contains: q, mode: "insensitive" } } } },
            ],
          }
        : {}),
    },
    include: { category: { select: { name: true } }, author: { select: { employee: { select: { name: true } } } }, audiences: true },
    orderBy: { updatedAt: "desc" },
    take: LIST_LIMIT,
  });
  const withMetrics = can(actor, "analytics.read");
  return Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      category: r.category?.name ?? null,
      author: r.author.employee.name,
      status: r.status,
      audience: audienceLabel(r.audiences),
      publishAt: r.publishAt,
      requiresAcknowledgement: r.requiresAcknowledgement,
      metrics: withMetrics && r.status !== "DRAFT" ? await metricsFor(prisma, r) : null,
    })),
  );
}

export interface AdminDashboard {
  publishedToday: number;
  scheduled: number;
  drafts: number;
  archived: number;
  awaitingAcknowledgement: number;
}

/** Cards da Central (§68). Só contagens reais do banco. */
export async function dashboardForAdmin(prisma: PrismaClient, actor: Actor, now: Date, startOfToday: Date): Promise<AdminDashboard> {
  assertCan(actor, "publication.create");
  await syncStatuses(prisma, now);
  const [publishedToday, scheduled, drafts, archived, ackRows] = await Promise.all([
    prisma.publication.count({ where: { status: "PUBLISHED", publishedAt: { gte: startOfToday } } }),
    prisma.publication.count({ where: { status: "SCHEDULED" } }),
    prisma.publication.count({ where: { status: "DRAFT" } }),
    prisma.publication.count({ where: { status: "ARCHIVED" } }),
    prisma.publication.findMany({ where: { status: "PUBLISHED", requiresAcknowledgement: true }, select: { id: true, version: true, requiresAcknowledgement: true, audiences: true } }),
  ]);
  const pending = await Promise.all(ackRows.map((r) => metricsFor(prisma, r)));
  return { publishedToday, scheduled, drafts, archived, awaitingAcknowledgement: pending.filter((m) => m.pending > 0).length };
}

export interface AdminPublication {
  id: string;
  type: PublicationType;
  title: string;
  summary: string;
  content: RichDoc;
  categoryId: string | null;
  isFeatured: boolean;
  pinned: boolean;
  requiresAcknowledgement: boolean;
  audiences: { audienceType: PublicationDraft["audiences"][number]["audienceType"]; audienceId: string | null }[];
  status: PublicationStatus;
  version: number;
  publishAt: Date | null;
  expiresAt: Date | null;
  author: string;
  lastEditor: string;
  updatedAt: Date;
}

export async function getForAdmin(prisma: PrismaClient, actor: Actor, id: string, now: Date): Promise<AdminPublication> {
  assertCan(actor, "publication.create");
  const p = await prisma.publication.findUnique({
    where: { id },
    include: { audiences: true, author: { select: { employee: { select: { name: true } } } }, lastEditor: { select: { employee: { select: { name: true } } } } },
  });
  if (!p) throw new BusinessError("ERR_NOT_FOUND");
  return {
    id: p.id,
    type: p.type,
    title: p.title,
    summary: p.summary,
    content: parseStoredDoc(p.content),
    categoryId: p.categoryId,
    isFeatured: p.isFeatured,
    pinned: p.pinned,
    requiresAcknowledgement: p.requiresAcknowledgement,
    audiences: p.audiences.map((a) => ({ audienceType: a.audienceType, audienceId: a.audienceId })),
    status: effectiveStatus(p, now),
    version: p.version,
    publishAt: p.publishAt,
    expiresAt: p.expiresAt,
    author: p.author.employee.name,
    lastEditor: p.lastEditor.employee.name,
    updatedAt: p.updatedAt,
  };
}

export async function metricsForAdmin(prisma: PrismaClient, actor: Actor, id: string): Promise<PublicationMetrics> {
  assertCan(actor, "analytics.read");
  const p = await prisma.publication.findUnique({ where: { id }, select: { id: true, version: true, requiresAcknowledgement: true, audiences: true } });
  if (!p) throw new BusinessError("ERR_NOT_FOUND");
  return metricsFor(prisma, p);
}

function toDraft(input: ParsedPublicationInput): PublicationDraft {
  return {
    type: input.type,
    title: input.title,
    content: input.content,
    requiresAcknowledgement: input.requiresAcknowledgement,
    pinned: input.pinned,
    audiences: input.audiences.map((a) => ({ audienceType: a.audienceType, audienceId: a.audienceType === "ALL" ? null : a.audienceId })),
    publishAt: input.publishAt ? fromLocalInput(input.publishAt) : null,
    expiresAt: input.expiresAt ? fromLocalInput(input.expiresAt) : null,
  };
}

function dataFrom(input: ParsedPublicationInput, draft: PublicationDraft) {
  return {
    title: input.title,
    summary: input.summary,
    content: input.content as unknown as Prisma.InputJsonValue,
    categoryId: input.categoryId,
    isFeatured: input.isFeatured,
    pinned: input.pinned,
    requiresAcknowledgement: input.requiresAcknowledgement,
    expiresAt: draft.expiresAt,
  };
}

async function assertCategory(tx: Tx, categoryId: string | null, type: PublicationType): Promise<void> {
  if (!categoryId) return;
  const c = await tx.publicationCategory.findUnique({ where: { id: categoryId }, select: { type: true } });
  if (!c || c.type !== type) throw new BusinessError("ERR_VALIDATION");
}

async function snapshot(tx: Tx, id: string, editorId: string): Promise<void> {
  const p = await tx.publication.findUniqueOrThrow({ where: { id }, select: { version: true, title: true, summary: true, content: true } });
  const content = p.content as Prisma.InputJsonValue;
  await tx.publicationVersion.upsert({
    where: { publicationId_version: { publicationId: id, version: p.version } },
    create: { publicationId: id, version: p.version, title: p.title, summary: p.summary, content, editorId },
    update: { title: p.title, summary: p.summary, content, editorId },
  });
}

/** Cria sempre como rascunho (§66). Rascunho pode ficar sem público (RN-COM-003, exceção). */
export async function createPublication(prisma: PrismaClient, actor: Actor, input: ParsedPublicationInput, ip: string | null): Promise<string> {
  assertCan(actor, "publication.create");
  const draft = toDraft(input);
  assertTypeRules(draft);
  return prisma.$transaction(async (tx) => {
    await assertCategory(tx, input.categoryId, input.type);
    const p = await tx.publication.create({
      data: {
        ...dataFrom(input, draft),
        type: input.type,
        authorId: actor.id,
        lastEditorId: actor.id,
        publishAt: draft.publishAt,
        audiences: { create: draft.audiences.map((a) => ({ audienceType: a.audienceType, audienceId: a.audienceId })) },
      },
      select: { id: true },
    });
    await audit(tx, { actorId: actor.id, action: "PUBLICATION_CREATED", entity: "publication", entityId: p.id, metadata: { type: input.type }, ip });
    return p.id;
  });
}

/**
 * Edição (RN-COM-004/007/008/009). Em publicação no ar: `material=true` sobe a versão e invalida a
 * ciência anterior; `material=false` preserva as confirmações e fica auditado como não material.
 */
export async function updatePublication(
  prisma: PrismaClient,
  actor: Actor,
  id: string,
  input: ParsedPublicationInput,
  material: boolean,
  now: Date,
  ip: string | null,
): Promise<void> {
  assertCan(actor, "publication.edit");
  await prisma.$transaction(async (tx) => {
    const current = await tx.publication.findUnique({ where: { id }, select: { type: true, status: true, publishAt: true, expiresAt: true } });
    if (!current) throw new BusinessError("ERR_NOT_FOUND");
    if (current.type !== input.type) throw new BusinessError("ERR_INVALID_PUBLICATION_TYPE");
    const status = effectiveStatus(current, now);
    if (status === "ARCHIVED" || status === "EXPIRED") throw new BusinessError("ERR_PUBLICATION_NOT_EDITABLE");
    const draft = toDraft(input);
    assertTypeRules(draft);
    if (status === "PUBLISHED") assertPublishable({ ...draft, publishAt: null }, "PUBLISHED", now);
    if (status === "SCHEDULED") assertPublishable(draft, "SCHEDULED", now);
    await assertCategory(tx, input.categoryId, input.type);

    const bump = status === "PUBLISHED" && material;
    await tx.publicationAudience.deleteMany({ where: { publicationId: id } });
    await tx.publication.update({
      where: { id },
      data: {
        ...dataFrom(input, draft),
        lastEditorId: actor.id,
        ...(status === "PUBLISHED" ? {} : { publishAt: draft.publishAt }),
        ...(bump ? { version: { increment: 1 } } : {}),
        audiences: { create: draft.audiences.map((a) => ({ audienceType: a.audienceType, audienceId: a.audienceId })) },
      },
    });
    if (status === "PUBLISHED" || status === "SCHEDULED") await snapshot(tx, id, actor.id);
    await audit(tx, {
      actorId: actor.id,
      action: "PUBLICATION_UPDATED",
      entity: "publication",
      entityId: id,
      metadata: { status, material: status === "PUBLISHED" ? material : null, newVersion: bump },
      ip,
    });
  });
}

async function loadDraft(tx: Tx, id: string): Promise<{ status: PublicationStatus; draft: PublicationDraft }> {
  const p = await tx.publication.findUnique({ where: { id }, include: { audiences: true } });
  if (!p) throw new BusinessError("ERR_NOT_FOUND");
  return {
    status: p.status,
    draft: {
      type: p.type,
      title: p.title,
      content: parseStoredDoc(p.content),
      requiresAcknowledgement: p.requiresAcknowledgement,
      pinned: p.pinned,
      audiences: p.audiences.map((a) => ({ audienceType: a.audienceType, audienceId: a.audienceId })),
      publishAt: p.publishAt,
      expiresAt: p.expiresAt,
    },
  };
}

/** Publicar agora (§66). */
export async function publishNow(prisma: PrismaClient, actor: Actor, id: string, now: Date, ip: string | null): Promise<void> {
  assertCan(actor, "publication.publish");
  await syncStatuses(prisma, now);
  await prisma.$transaction(async (tx) => {
    const { status, draft } = await loadDraft(tx, id);
    assertTransition(status, "PUBLISHED");
    assertPublishable(draft, "PUBLISHED", now);
    await tx.publication.update({ where: { id }, data: { status: "PUBLISHED", publishAt: now, publishedAt: now, lastEditorId: actor.id } });
    await snapshot(tx, id, actor.id);
    await audit(tx, { actorId: actor.id, action: "PUBLICATION_PUBLISHED", entity: "publication", entityId: id, ip });
  });
}

/** Agendar ou reagendar (RN-COM-005). Só fica visível em publish_at. */
export async function schedule(prisma: PrismaClient, actor: Actor, id: string, publishAt: Date, now: Date, ip: string | null): Promise<void> {
  assertCan(actor, "publication.publish");
  await syncStatuses(prisma, now);
  await prisma.$transaction(async (tx) => {
    const { status, draft } = await loadDraft(tx, id);
    if (status !== "SCHEDULED") assertTransition(status, "SCHEDULED");
    assertPublishable({ ...draft, publishAt }, "SCHEDULED", now);
    await tx.publication.update({ where: { id }, data: { status: "SCHEDULED", publishAt, lastEditorId: actor.id } });
    await snapshot(tx, id, actor.id);
    await audit(tx, { actorId: actor.id, action: "PUBLICATION_SCHEDULED", entity: "publication", entityId: id, metadata: { publishAt: publishAt.toISOString() }, ip });
  });
}

export async function unschedule(prisma: PrismaClient, actor: Actor, id: string, now: Date, ip: string | null): Promise<void> {
  assertCan(actor, "publication.publish");
  await syncStatuses(prisma, now);
  await prisma.$transaction(async (tx) => {
    const { status } = await loadDraft(tx, id);
    assertTransition(status, "DRAFT");
    await tx.publication.update({ where: { id }, data: { status: "DRAFT", publishAt: null, lastEditorId: actor.id } });
    await audit(tx, { actorId: actor.id, action: "PUBLICATION_UNSCHEDULED", entity: "publication", entityId: id, ip });
  });
}

/** Arquivar tira do feed e preserva URL administrativa, métricas e auditoria (RN-COM-010). */
export async function archive(prisma: PrismaClient, actor: Actor, id: string, now: Date, ip: string | null): Promise<void> {
  assertCan(actor, "publication.archive");
  await syncStatuses(prisma, now);
  await prisma.$transaction(async (tx) => {
    const { status } = await loadDraft(tx, id);
    assertTransition(status, "ARCHIVED");
    await tx.publication.update({ where: { id }, data: { status: "ARCHIVED", archivedAt: now, lastEditorId: actor.id } });
    await audit(tx, { actorId: actor.id, action: "PUBLICATION_ARCHIVED", entity: "publication", entityId: id, metadata: { from: status }, ip });
  });
}

/** Exclusão física só de rascunho (RN-COM-011). */
export async function deleteDraft(prisma: PrismaClient, actor: Actor, id: string, ip: string | null): Promise<void> {
  assertCan(actor, "publication.edit");
  await prisma.$transaction(async (tx) => {
    const p = await tx.publication.findUnique({ where: { id }, select: { status: true, title: true } });
    if (!p) throw new BusinessError("ERR_NOT_FOUND");
    if (p.status !== "DRAFT") throw new BusinessError("ERR_INVALID_TRANSITION");
    await tx.publication.delete({ where: { id } });
    await audit(tx, { actorId: actor.id, action: "PUBLICATION_DELETED", entity: "publication", entityId: id, ip });
  });
}

export async function listCategories(prisma: PrismaClient): Promise<{ id: string; type: PublicationType; name: string }[]> {
  return prisma.publicationCategory.findMany({ select: { id: true, type: true, name: true }, orderBy: [{ type: "asc" }, { name: "asc" }] });
}

export async function createCategory(prisma: PrismaClient, actor: Actor, type: PublicationType, name: string, ip: string | null): Promise<void> {
  assertCan(actor, "category.manage");
  await prisma.$transaction(async (tx) => {
    const exists = await tx.publicationCategory.findUnique({ where: { type_name: { type, name } } });
    if (exists) throw new BusinessError("ERR_VALIDATION", "Já existe uma categoria com esse nome.");
    const c = await tx.publicationCategory.create({ data: { type, name } });
    await audit(tx, { actorId: actor.id, action: "CATEGORY_CREATED", entity: "publication_category", entityId: c.id, metadata: { type, name }, ip });
  });
}

/** Valores de unidade e departamento vindos do CSV, para o seletor de público (§64). */
export async function audienceOptions(prisma: PrismaClient, actor: Actor): Promise<{ units: string[]; departments: string[] }> {
  assertCan(actor, "publication.create");
  const [units, departments] = await Promise.all([
    prisma.employee.findMany({ where: { status: "ACTIVE" }, distinct: ["unit"], select: { unit: true }, orderBy: { unit: "asc" } }),
    prisma.employee.findMany({ where: { status: "ACTIVE" }, distinct: ["department"], select: { department: true }, orderBy: { department: "asc" } }),
  ]);
  return { units: units.map((u) => u.unit).filter(Boolean), departments: departments.map((d) => d.department).filter(Boolean) };
}
