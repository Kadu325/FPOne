import type { Prisma } from "@/generated/prisma/client";
import type { AudienceType, PublicationStatus, PublicationType } from "@/generated/prisma/enums";
import { BusinessError } from "@/lib/errors";
import { plainText, type RichDoc } from "@/modules/publications/content";

/** Transições permitidas (§171). Qualquer outra é erro de negócio (RN-COM-001). */
const TRANSITIONS: Record<PublicationStatus, readonly PublicationStatus[]> = {
  DRAFT: ["SCHEDULED", "PUBLISHED", "ARCHIVED"],
  SCHEDULED: ["DRAFT", "PUBLISHED", "ARCHIVED"],
  PUBLISHED: ["ARCHIVED", "EXPIRED"],
  EXPIRED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function canTransition(from: PublicationStatus, to: PublicationStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: PublicationStatus, to: PublicationStatus): void {
  if (!canTransition(from, to)) throw new BusinessError("ERR_INVALID_TRANSITION");
}

/**
 * Status efetivo no instante `now` (agendamento e expiração checados na leitura, decisão da Fase 5):
 * SCHEDULED com publish_at vencido já é PUBLISHED; PUBLISHED com expires_at vencido é EXPIRED.
 */
export function effectiveStatus(p: { status: PublicationStatus; publishAt: Date | null; expiresAt: Date | null }, now: Date): PublicationStatus {
  let status = p.status;
  if (status === "SCHEDULED" && p.publishAt && p.publishAt <= now) status = "PUBLISHED";
  if (status === "PUBLISHED" && p.expiresAt && p.expiresAt <= now) status = "EXPIRED";
  return status;
}

/** WHERE de vigência para o feed (RN-COM-005/006/010). Combinar sempre com audienceFilter. */
export function visibleWhere(now: Date): Prisma.PublicationWhereInput {
  return {
    status: { in: ["SCHEDULED", "PUBLISHED"] },
    publishAt: { lte: now },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };
}

export interface PublicationDraft {
  type: PublicationType;
  title: string;
  content: RichDoc;
  requiresAcknowledgement: boolean;
  pinned: boolean;
  audiences: readonly { audienceType: AudienceType; audienceId: string | null }[];
  publishAt: Date | null;
  expiresAt: Date | null;
}

/** RN-NEWS-001: Novidade nunca exige ciência nem é fixada. Vale também para rascunho. */
export function assertTypeRules(d: Pick<PublicationDraft, "type" | "requiresAcknowledgement" | "pinned">): void {
  if (d.type === "NEWS" && (d.requiresAcknowledgement || d.pinned)) throw new BusinessError("ERR_INVALID_PUBLICATION_TYPE");
}

/** Público válido: ALL sem id; os demais com id não vazio (RN-COM-003). */
export function validAudiences(list: PublicationDraft["audiences"]): boolean {
  return list.length > 0 && list.every((a) => (a.audienceType === "ALL" ? a.audienceId === null : typeof a.audienceId === "string" && a.audienceId.trim() !== ""));
}

/** Pré-condições para publicar ou agendar (RN-COM-002, RN-COM-003, datas coerentes). */
export function assertPublishable(d: PublicationDraft, target: "PUBLISHED" | "SCHEDULED", now: Date): void {
  assertTypeRules(d);
  if (d.title.trim() === "" || plainText(d.content) === "") throw new BusinessError("ERR_PUBLICATION_INCOMPLETE");
  if (!validAudiences(d.audiences)) throw new BusinessError("ERR_PUBLICATION_NO_AUDIENCE");
  if (target === "SCHEDULED" && (!d.publishAt || d.publishAt <= now)) throw new BusinessError("ERR_INVALID_SCHEDULE");
  const start = target === "SCHEDULED" ? d.publishAt : now;
  if (d.expiresAt && start && d.expiresAt <= start) throw new BusinessError("ERR_INVALID_SCHEDULE");
}

/** Ciência válida só para a versão atual (RN-ACK-002/006). */
export function hasValidAcknowledgement(read: { acknowledgedVersion: number | null } | null | undefined, version: number): boolean {
  return read?.acknowledgedVersion === version;
}

/**
 * Usuários ativos que pertencem ao público (destinatários válidos, RN-ACK-004/005/007).
 * Mesma regra do audienceFilter, vista do lado do usuário: ALL; USER listado; ou E entre
 * UNIT/DEPARTMENT presentes (OU dentro de cada tipo). GROUP ainda sem cadastro: não casa.
 */
export function recipientsWhere(audiences: readonly { audienceType: AudienceType; audienceId: string | null }[]): Prisma.UserWhereInput {
  const active: Prisma.UserWhereInput = { employee: { status: "ACTIVE" } };
  if (audiences.some((a) => a.audienceType === "ALL")) return active;
  const ids = (t: AudienceType) => audiences.filter((a) => a.audienceType === t && a.audienceId).map((a) => a.audienceId as string);
  const or: Prisma.UserWhereInput[] = [];
  if (ids("USER").length) or.push({ id: { in: ids("USER") } });
  const structural: Prisma.UserWhereInput[] = [];
  if (ids("UNIT").length) structural.push({ employee: { unit: { in: ids("UNIT") } } });
  if (ids("DEPARTMENT").length) structural.push({ employee: { department: { in: ids("DEPARTMENT") } } });
  const hasGroup = audiences.some((a) => a.audienceType === "GROUP");
  if (structural.length > 0 && !hasGroup) or.push({ AND: structural });
  if (or.length === 0) return { id: { in: [] } };
  return { AND: [active, { OR: or }] };
}

export interface PublicationMetrics {
  recipients: number;
  viewed: number;
  acknowledged: number;
  pending: number;
  readRate: number | null;
  ackRate: number | null;
}

/** Taxas sobre destinatários válidos (RN-ACK-007). Sem destinatário, taxa nula (não 0% inventado). */
export function computeMetrics(recipients: number, viewed: number, acknowledged: number, requiresAck: boolean): PublicationMetrics {
  const rate = (n: number) => (recipients === 0 ? null : Math.round((n / recipients) * 100));
  return {
    recipients,
    viewed,
    acknowledged: requiresAck ? acknowledged : 0,
    pending: requiresAck ? Math.max(recipients - acknowledged, 0) : 0,
    readRate: rate(viewed),
    ackRate: requiresAck ? rate(acknowledged) : null,
  };
}
