import type { Prisma } from "@/generated/prisma/client";

/** Eventos auditados (§19, §184). */
export type AuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "LOGIN_FAILED"
  | "LOGIN_LOCKED"
  | "USER_PROVISIONED"
  | "FIRST_ACCESS_VERIFIED"
  | "PIN_CREATED"
  | "PIN_RESET"
  | "IMPORT_EMPLOYEES"
  | "USER_DEACTIVATED"
  | "USER_REACTIVATED"
  | "ROLE_CHANGED"
  | "ADMIN_BOOTSTRAP"
  | "PUBLICATION_CREATED"
  | "PUBLICATION_UPDATED"
  | "PUBLICATION_PUBLISHED"
  | "PUBLICATION_SCHEDULED"
  | "PUBLICATION_UNSCHEDULED"
  | "PUBLICATION_ARCHIVED"
  | "PUBLICATION_DELETED"
  | "PUBLICATION_ACKNOWLEDGED"
  | "CATEGORY_CREATED"
  | "EMPLOYEE_CONTACT_UPDATED"
  | "RESPONSIBILITIES_UPDATED"
  | "LINK_SAVED"
  | "LINK_DELETED"
  | "EVENT_SAVED"
  | "EVENT_PUBLISHED"
  | "EVENT_CANCELLED"
  | "EVENT_DELETED"
  | "DOCUMENT_SAVED"
  | "DOCUMENT_VERSION_UPLOADED"
  | "DOCUMENT_PUBLISHED"
  | "DOCUMENT_ARCHIVED"
  | "DOCUMENT_DELETED"
  | "DOCUMENT_DOWNLOADED"
  | "AUDIT_EXPORTED";

export type AuditMetadata = Record<string, string | number | boolean | null | string[]>;

export interface AuditEntry {
  actorId: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  metadata?: AuditMetadata;
  ip?: string | null;
}

/** Chaves que nunca podem ir para a auditoria (LGPD, §184). */
const FORBIDDEN_KEY = /cpf|pin|password|senha|secret|token/i;

export function assertSafeMetadata(metadata: AuditMetadata): void {
  const bad = Object.keys(metadata).filter((k) => FORBIDDEN_KEY.test(k));
  if (bad.length > 0) throw new Error(`Metadata de auditoria com chave proibida: ${bad.join(", ")}`);
}

type AuditWriter = Pick<Prisma.TransactionClient, "auditLog">;

/** Grava na trilha (append-only; UPDATE/DELETE bloqueados por trigger no banco). */
export async function audit(client: AuditWriter, entry: AuditEntry): Promise<void> {
  const metadata = entry.metadata ?? {};
  assertSafeMetadata(metadata);
  await client.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      metadata,
      ip: entry.ip ?? null,
    },
  });
}
