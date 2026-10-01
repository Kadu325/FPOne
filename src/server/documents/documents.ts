import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { BusinessError } from "@/lib/errors";
import { audit } from "@/server/audit/audit";
import { audienceFilter, type AudienceSubject } from "@/server/authz/audience";
import { presignDownload } from "@/server/storage/s3";

/**
 * Documentos do colaborador (§161). Só publicados e do público do usuário (RN-DOC-005); o
 * download valida autorização antes de gerar a URL (RN-DOC-007) e fica na auditoria.
 */

export interface DocumentItem {
  id: string;
  title: string;
  description: string;
  category: string;
  version: number;
  publishedAt: Date | null;
  updatedAt: Date;
  fileName: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
}

const select = {
  id: true,
  title: true,
  description: true,
  category: true,
  currentVersion: true,
  publishedAt: true,
  updatedAt: true,
  versions: { where: { status: "PUBLISHED" }, select: { fileName: true, mimeType: true, sizeBytes: true, createdAt: true }, take: 1 },
} satisfies Prisma.DocumentSelect;

type Row = Prisma.DocumentGetPayload<{ select: typeof select }>;

function toItem(r: Row): DocumentItem {
  const v = r.versions[0];
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    version: r.currentVersion,
    publishedAt: r.publishedAt,
    updatedAt: v?.createdAt ?? r.updatedAt,
    fileName: v?.fileName ?? null,
    mimeType: v?.mimeType ?? null,
    sizeBytes: v?.sizeBytes ?? null,
  };
}

export async function listDocuments(prisma: PrismaClient, subject: AudienceSubject, filter: { category?: string; limit?: number } = {}): Promise<DocumentItem[]> {
  const rows = await prisma.document.findMany({
    where: { AND: [{ status: "PUBLISHED" }, filter.category ? { category: filter.category } : {}, audienceFilter(subject)] },
    select,
    orderBy: { updatedAt: "desc" },
    take: filter.limit ?? 200,
  });
  return rows.map(toItem);
}

/** Para a busca global: mesma segurança, só os ids ranqueados. */
export async function documentsByIds(prisma: PrismaClient, subject: AudienceSubject, ids: string[]): Promise<DocumentItem[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.document.findMany({ where: { AND: [{ id: { in: ids }, status: "PUBLISHED" }, audienceFilter(subject)] }, select });
  const order = new Map(ids.map((id, i) => [id, i]));
  return rows.map(toItem).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

/** URL pré-assinada curta da versão vigente, depois de checar vigência e audiência. */
export async function downloadUrl(prisma: PrismaClient, subject: AudienceSubject, id: string, ip: string | null): Promise<string> {
  const doc = await prisma.document.findFirst({
    where: { AND: [{ id, status: "PUBLISHED" }, audienceFilter(subject)] },
    select: { id: true, currentVersion: true, versions: { where: { status: "PUBLISHED" }, select: { version: true, storageKey: true, fileName: true, mimeType: true }, take: 1 } },
  });
  const version = doc?.versions[0];
  if (!doc || !version) throw new BusinessError("ERR_NOT_FOUND");
  const url = await presignDownload(version.storageKey, version.fileName, version.mimeType);
  await audit(prisma, { actorId: subject.userId, action: "DOCUMENT_DOWNLOADED", entity: "document", entityId: doc.id, metadata: { version: version.version }, ip });
  return url;
}
