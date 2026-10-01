import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { AUDIT_ACTIONS, actionLabel } from "@/modules/audit/labels";
import { assertCan, type Actor } from "@/server/authz/can";

/**
 * Consulta da trilha (RN-AUD-004): só com audit.read (ADMIN). Somente leitura; a tabela é
 * append-only no banco (RN-AUD-001). Metadados nunca têm CPF/PIN (assertSafeMetadata na escrita).
 */

const day = z
  .string()
  .trim()
  .transform((v) => (v === "" ? undefined : v))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional());

export const auditFilterSchema = z.object({
  action: z
    .string()
    .optional()
    .transform((v) => (v && (AUDIT_ACTIONS as string[]).includes(v) ? v : undefined)),
  entity: z
    .string()
    .trim()
    .max(40)
    .optional()
    .transform((v) => v || undefined),
  person: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => v || undefined),
  from: day.optional(),
  to: day.optional(),
  before: z
    .string()
    .regex(/^\d{1,19}$/)
    .optional(),
});
export type AuditFilter = z.output<typeof auditFilterSchema>;

export interface AuditRow {
  id: string;
  createdAt: Date;
  action: string;
  actionLabel: string;
  entity: string;
  entityId: string | null;
  actor: string;
  ip: string | null;
  metadata: string;
}

export const PAGE_SIZE = 50;
export const EXPORT_LIMIT = 10_000;

/** Dias do filtro são dias da Bahia (UTC−3 fixo). */
const startOf = (d: string) => new Date(`${d}T00:00:00-03:00`);
const endOf = (d: string) => new Date(new Date(`${d}T00:00:00-03:00`).getTime() + 86_400_000);

async function whereFor(prisma: PrismaClient, f: AuditFilter): Promise<Prisma.AuditLogWhereInput | null> {
  let actorIds: string[] | undefined;
  if (f.person) {
    const users = await prisma.user.findMany({
      where: { employee: { OR: [{ name: { contains: f.person, mode: "insensitive" } }, { matricula: f.person }] } },
      select: { id: true },
      take: 50,
    });
    if (users.length === 0) return null;
    actorIds = users.map((u) => u.id);
  }
  return {
    ...(f.action ? { action: f.action } : {}),
    ...(f.entity ? { entity: f.entity } : {}),
    ...(actorIds ? { actorId: { in: actorIds } } : {}),
    ...(f.from || f.to ? { createdAt: { ...(f.from ? { gte: startOf(f.from) } : {}), ...(f.to ? { lt: endOf(f.to) } : {}) } } : {}),
  };
}

async function toRows(prisma: PrismaClient, logs: { id: bigint; createdAt: Date; action: string; entity: string; entityId: string | null; actorId: string | null; ip: string | null; metadata: Prisma.JsonValue }[]): Promise<AuditRow[]> {
  const ids = [...new Set(logs.map((l) => l.actorId).filter((v): v is string => v !== null))];
  const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, employee: { select: { name: true } } } });
  const name = new Map(users.map((u) => [u.id, u.employee.name]));
  return logs.map((l) => ({
    id: l.id.toString(),
    createdAt: l.createdAt,
    action: l.action,
    actionLabel: actionLabel(l.action),
    entity: l.entity,
    entityId: l.entityId,
    actor: l.actorId ? (name.get(l.actorId) ?? "Usuário removido") : "Sistema / não identificado",
    ip: l.ip,
    metadata: l.metadata && typeof l.metadata === "object" && Object.keys(l.metadata).length > 0 ? JSON.stringify(l.metadata) : "",
  }));
}

/** Página de 50, do mais recente para o mais antigo (cursor = id). */
export async function listAudit(prisma: PrismaClient, actor: Actor | null, f: AuditFilter): Promise<{ rows: AuditRow[]; nextBefore: string | null }> {
  assertCan(actor, "audit.read");
  const where = await whereFor(prisma, f);
  if (!where) return { rows: [], nextBefore: null };
  const logs = await prisma.auditLog.findMany({
    where: { ...where, ...(f.before ? { id: { lt: BigInt(f.before) } } : {}) },
    orderBy: { id: "desc" },
    take: PAGE_SIZE + 1,
  });
  const page = logs.slice(0, PAGE_SIZE);
  return { rows: await toRows(prisma, page), nextBefore: logs.length > PAGE_SIZE ? (page[page.length - 1]?.id.toString() ?? null) : null };
}

export async function exportAudit(prisma: PrismaClient, actor: Actor | null, f: AuditFilter): Promise<AuditRow[]> {
  assertCan(actor, "audit.read");
  const where = await whereFor(prisma, f);
  if (!where) return [];
  const logs = await prisma.auditLog.findMany({ where, orderBy: { id: "desc" }, take: EXPORT_LIMIT });
  return toRows(prisma, logs);
}

export async function auditEntities(prisma: PrismaClient): Promise<string[]> {
  const rows = await prisma.auditLog.findMany({ distinct: ["entity"], select: { entity: true }, orderBy: { entity: "asc" } });
  return rows.map((r) => r.entity);
}

/** CSV com ; e aspas (padrão Excel pt-BR). */
export function auditCsv(rows: AuditRow[], format: (d: Date) => string): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = rows.map((r) => [r.id, format(r.createdAt), r.actionLabel, r.action, r.entity, r.entityId ?? "", r.actor, r.ip ?? "", r.metadata].map(esc).join(";"));
  return ["id;data_hora;acao;codigo;entidade;id_entidade;autor;ip;detalhes", ...lines].join("\r\n");
}
