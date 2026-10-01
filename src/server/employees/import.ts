import type { PrismaClient } from "@/generated/prisma/client";
import { audit } from "@/server/audit/audit";
import { hashCpf } from "@/server/auth/cpf";
import { assertCan, type Actor } from "@/server/authz/can";
import type { EmployeeRow, RowError } from "./csv";

export interface ImportSummary {
  total: number;
  created: number;
  updated: number;
  deactivated: number;
  reactivated: number;
  absent: { matricula: string; name: string }[];
}

export type ImportResult = { ok: true; summary: ImportSummary } | { ok: false; errors: RowError[] };

export async function importEmployees(
  prisma: PrismaClient,
  actor: Actor | null,
  parsed: { rows: EmployeeRow[]; errors: RowError[] },
  cpfPepper: string,
  ip: string | null,
): Promise<ImportResult> {
  assertCan(actor, "employee.import");
  if (parsed.errors.length > 0) return { ok: false, errors: parsed.errors };

  const rows = parsed.rows;
  const outcome = await prisma.$transaction(
    async (tx) => {
      const existing = await tx.employee.findMany({ include: { user: true } });
      const byMatricula = new Map(existing.map((e) => [e.matricula, e]));

      const inFile = new Set(rows.map((r) => r.matricula));
      const emailOwner = new Map(existing.filter((e) => e.corporateEmail).map((e) => [e.corporateEmail as string, e.matricula]));
      const conflicts: RowError[] = [];
      for (const r of rows) {
        const owner = r.corporateEmail ? emailOwner.get(r.corporateEmail) : undefined;
        if (owner && !inFile.has(owner)) {
          conflicts.push({ line: r.line, matricula: r.matricula, field: "email_corporativo", message: `já pertence à matrícula ${owner}` });
        }
      }
      if (conflicts.length > 0) return { kind: "conflicts" as const, conflicts };

      const s: ImportSummary = { total: rows.length, created: 0, updated: 0, deactivated: 0, reactivated: 0, absent: [] };
      await tx.employee.updateMany({
        where: { matricula: { in: rows.map((r) => r.matricula) } },
        data: { corporateEmail: null },
      });

      for (const r of rows) {
        const data = {
          name: r.name,
          unit: r.unit,
          department: r.department,
          jobTitle: r.jobTitle,
          corporateEmail: r.corporateEmail,
          ...(r.corporatePhone !== undefined ? { corporatePhone: r.corporatePhone } : {}),
          ...(r.birth !== undefined ? { birthDay: r.birth?.day ?? null, birthMonth: r.birth?.month ?? null } : {}),
          status: r.status,
          cpfHash: hashCpf(r.cpf, cpfPepper),
        };
        const current = byMatricula.get(r.matricula);
        if (!current) {
          await tx.employee.create({ data: { matricula: r.matricula, ...data, user: { create: {} } } });
          s.created++;
          continue;
        }
        await tx.employee.update({ where: { id: current.id }, data });
        s.updated++;
        const wasActive = current.status === "ACTIVE";
        if (wasActive && r.status === "INACTIVE") s.deactivated++;
        if (!wasActive && r.status === "ACTIVE") s.reactivated++;
        if (current.user) {
          if (wasActive && r.status === "INACTIVE") {
            await tx.user.update({ where: { id: current.user.id }, data: { sessionVersion: { increment: 1 } } });
          }
        } else {
          await tx.user.create({ data: { employeeId: current.id } });
        }
      }

      s.absent = existing
        .filter((e) => e.status === "ACTIVE" && !inFile.has(e.matricula))
        .map((e) => ({ matricula: e.matricula, name: e.name }));

      await audit(tx, {
        actorId: actor.id,
        action: "IMPORT_EMPLOYEES",
        entity: "employee",
        metadata: {
          total: s.total,
          created: s.created,
          updated: s.updated,
          deactivated: s.deactivated,
          reactivated: s.reactivated,
          absent: s.absent.length,
        },
        ip,
      });
      return { kind: "ok" as const, summary: s };
    },
    { timeout: 120_000 },
  );

  if (outcome.kind === "conflicts") return { ok: false, errors: outcome.conflicts };
  return { ok: true, summary: outcome.summary };
}
