import { createHash, randomUUID } from "node:crypto";
import type { PrismaClient } from "@/generated/prisma/client";
import { z } from "zod";
import { AudienceType, type DocumentStatus } from "@/generated/prisma/enums";
import { BusinessError } from "@/lib/errors";
import { checkDocumentFile, DOCUMENT_CATEGORIES, FILE_ERRORS } from "@/modules/documents/file";
import { audit } from "@/server/audit/audit";
import { assertCan, type Actor } from "@/server/authz/can";
import { validAudiences } from "@/server/publications/rules";
import { deleteObject, presignDownload, putObject } from "@/server/storage/s3";

/**
 * FPOne Admin › Documentos (§161).
 */

const localDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable());

export const documentMetaSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(1000),
  category: z.enum(DOCUMENT_CATEGORIES),
  effectiveAt: localDate,
  reviewAt: localDate,
  audiences: z.array(z.object({ audienceType: z.enum(AudienceType), audienceId: z.string().trim().max(200).nullable() })).max(50),
});

export type DocumentMetaInput = Omit<z.input<typeof documentMetaSchema>, "category"> & { category: string };

const asDate = (v: string | null) => (v ? new Date(`${v}T12:00:00-03:00`) : null);

export interface AdminDocument {
  id: string;
  title: string;
  description: string;
  category: string;
  status: DocumentStatus;
  currentVersion: number;
  effectiveAt: Date | null;
  reviewAt: Date | null;
  owner: string;
  audiences: { audienceType: AudienceType; audienceId: string | null }[];
  versions: { version: number; fileName: string; sizeBytes: number; status: DocumentStatus; createdAt: Date; uploadedBy: string }[];
}

export async function listDocumentsForAdmin(prisma: PrismaClient, actor: Actor | null): Promise<{ id: string; title: string; category: string; status: DocumentStatus; currentVersion: number; updatedAt: Date }[]> {
  assertCan(actor, "document.manage");
  return prisma.document.findMany({ select: { id: true, title: true, category: true, status: true, currentVersion: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 300 });
}

export async function getDocumentForAdmin(prisma: PrismaClient, actor: Actor | null, id: string): Promise<AdminDocument> {
  assertCan(actor, "document.manage");
  const d = await prisma.document.findUnique({
    where: { id },
    include: {
      audiences: true,
      owner: { select: { employee: { select: { name: true } } } },
      versions: { orderBy: { version: "desc" }, include: { uploadedBy: { select: { employee: { select: { name: true } } } } } },
    },
  });
  if (!d) throw new BusinessError("ERR_NOT_FOUND");
  return {
    id: d.id,
    title: d.title,
    description: d.description,
    category: d.category,
    status: d.status,
    currentVersion: d.currentVersion,
    effectiveAt: d.effectiveAt,
    reviewAt: d.reviewAt,
    owner: d.owner.employee.name,
    audiences: d.audiences.map((a) => ({ audienceType: a.audienceType, audienceId: a.audienceType === "ALL" ? null : a.audienceId })),
    versions: d.versions.map((v) => ({ version: v.version, fileName: v.fileName, sizeBytes: v.sizeBytes, status: v.status, createdAt: v.createdAt, uploadedBy: v.uploadedBy.employee.name })),
  };
}

function metaData(input: z.output<typeof documentMetaSchema>) {
  const audiences = input.audiences.map((a) => ({ audienceType: a.audienceType, audienceId: a.audienceType === "ALL" ? null : a.audienceId }));
  if (!validAudiences(audiences)) throw new BusinessError("ERR_PUBLICATION_NO_AUDIENCE");
  return { data: { title: input.title, description: input.description, category: input.category, effectiveAt: asDate(input.effectiveAt), reviewAt: asDate(input.reviewAt) }, audiences };
}

export async function saveDocument(prisma: PrismaClient, actor: Actor | null, id: string | null, input: z.output<typeof documentMetaSchema>, ip: string | null): Promise<string> {
  assertCan(actor, "document.manage");
  const { data, audiences } = metaData(input);
  return prisma.$transaction(async (tx) => {
    let docId: string;
    if (id) {
      const current = await tx.document.findUnique({ where: { id }, select: { status: true } });
      if (!current) throw new BusinessError("ERR_NOT_FOUND");
      if (current.status === "ARCHIVED") throw new BusinessError("ERR_PUBLICATION_NOT_EDITABLE");
      await tx.documentAudience.deleteMany({ where: { documentId: id } });
      await tx.document.update({ where: { id }, data: { ...data, audiences: { create: audiences } } });
      docId = id;
    } else {
      const created = await tx.document.create({ data: { ...data, ownerId: actor.id, audiences: { create: audiences } }, select: { id: true } });
      docId = created.id;
    }
    await audit(tx, { actorId: actor.id, action: "DOCUMENT_SAVED", entity: "document", entityId: docId, metadata: { created: !id }, ip });
    return docId;
  });
}

export async function uploadVersion(prisma: PrismaClient, actor: Actor | null, id: string, fileName: string, bytes: Uint8Array, now: Date, ip: string | null): Promise<number> {
  assertCan(actor, "document.manage");
  const check = checkDocumentFile(fileName, bytes.byteLength, bytes.subarray(0, 16));
  if (!check.ok) throw new BusinessError("ERR_INVALID_FILE", FILE_ERRORS[check.reason]);
  const doc = await prisma.document.findUnique({ where: { id }, select: { status: true } });
  if (!doc) throw new BusinessError("ERR_NOT_FOUND");
  if (doc.status === "ARCHIVED") throw new BusinessError("ERR_PUBLICATION_NOT_EDITABLE");

  const storageKey = `documents/${id}/${randomUUID()}.${check.ext}`;
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  await putObject(storageKey, bytes, check.mime);
  try {
    return await prisma.$transaction(async (tx) => {
      const current = await tx.document.findUniqueOrThrow({ where: { id }, select: { status: true } });
      const last = await tx.documentVersion.aggregate({ where: { documentId: id }, _max: { version: true } });
      const version = (last._max.version ?? 0) + 1;
      const live = current.status === "PUBLISHED";
      if (live) await tx.documentVersion.updateMany({ where: { documentId: id, status: "PUBLISHED" }, data: { status: "SUPERSEDED" } });
      await tx.documentVersion.create({
        data: {
          documentId: id,
          version,
          fileName: check.fileName,
          storageKey,
          mimeType: check.mime,
          sizeBytes: bytes.byteLength,
          sha256,
          status: live ? "PUBLISHED" : "DRAFT",
          uploadedById: actor.id,
          publishedAt: live ? now : null,
        },
      });
      await tx.document.update({ where: { id }, data: { currentVersion: version } });
      await audit(tx, { actorId: actor.id, action: "DOCUMENT_VERSION_UPLOADED", entity: "document", entityId: id, metadata: { version, sizeBytes: bytes.byteLength, live }, ip });
      return version;
    });
  } catch (e) {
    await deleteObject(storageKey).catch(() => undefined);
    throw e;
  }
}

export async function publishDocument(prisma: PrismaClient, actor: Actor | null, id: string, now: Date, ip: string | null): Promise<void> {
  assertCan(actor, "document.manage");
  await prisma.$transaction(async (tx) => {
    const d = await tx.document.findUnique({ where: { id }, include: { audiences: true } });
    if (!d) throw new BusinessError("ERR_NOT_FOUND");
    if (d.status !== "DRAFT") throw new BusinessError("ERR_INVALID_TRANSITION");
    if (d.currentVersion === 0) throw new BusinessError("ERR_DOCUMENT_WITHOUT_FILE");
    if (!validAudiences(d.audiences)) throw new BusinessError("ERR_PUBLICATION_NO_AUDIENCE");
    await tx.documentVersion.updateMany({ where: { documentId: id, version: { lt: d.currentVersion }, status: "DRAFT" }, data: { status: "SUPERSEDED" } });
    await tx.documentVersion.update({ where: { documentId_version: { documentId: id, version: d.currentVersion } }, data: { status: "PUBLISHED", publishedAt: now } });
    await tx.document.update({ where: { id }, data: { status: "PUBLISHED", publishedAt: now } });
    await audit(tx, { actorId: actor.id, action: "DOCUMENT_PUBLISHED", entity: "document", entityId: id, metadata: { version: d.currentVersion }, ip });
  });
}

export async function archiveDocument(prisma: PrismaClient, actor: Actor | null, id: string, now: Date, ip: string | null): Promise<void> {
  assertCan(actor, "document.manage");
  await prisma.$transaction(async (tx) => {
    const d = await tx.document.findUnique({ where: { id }, select: { status: true } });
    if (!d) throw new BusinessError("ERR_NOT_FOUND");
    if (d.status !== "PUBLISHED") throw new BusinessError("ERR_INVALID_TRANSITION");
    await tx.document.update({ where: { id }, data: { status: "ARCHIVED", archivedAt: now } });
    await audit(tx, { actorId: actor.id, action: "DOCUMENT_ARCHIVED", entity: "document", entityId: id, ip });
  });
}

export async function deleteDraftDocument(prisma: PrismaClient, actor: Actor | null, id: string, ip: string | null): Promise<void> {
  assertCan(actor, "document.manage");
  const keys = await prisma.$transaction(async (tx) => {
    const d = await tx.document.findUnique({ where: { id }, select: { status: true, publishedAt: true, versions: { select: { storageKey: true } } } });
    if (!d) throw new BusinessError("ERR_NOT_FOUND");
    if (d.status !== "DRAFT" || d.publishedAt) throw new BusinessError("ERR_INVALID_TRANSITION");
    await tx.document.delete({ where: { id } });
    await audit(tx, { actorId: actor.id, action: "DOCUMENT_DELETED", entity: "document", entityId: id, ip });
    return d.versions.map((v) => v.storageKey);
  });
  await Promise.all(keys.map((k) => deleteObject(k).catch(() => undefined)));
}

export async function adminDownloadUrl(prisma: PrismaClient, actor: Actor | null, id: string, version: number, ip: string | null): Promise<string> {
  assertCan(actor, "document.manage");
  const v = await prisma.documentVersion.findUnique({ where: { documentId_version: { documentId: id, version } }, select: { storageKey: true, fileName: true, mimeType: true } });
  if (!v) throw new BusinessError("ERR_NOT_FOUND");
  const url = await presignDownload(v.storageKey, v.fileName, v.mimeType);
  await audit(prisma, { actorId: actor.id, action: "DOCUMENT_DOWNLOADED", entity: "document", entityId: id, metadata: { version, admin: true }, ip });
  return url;
}
