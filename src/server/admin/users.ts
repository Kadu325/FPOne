import type { PrismaClient } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { BusinessError } from "@/lib/errors";
import { audit } from "@/server/audit/audit";
import { assertCan, type Actor } from "@/server/authz/can";

/** Inativação/reativação manual (RN-AUTH-003/004). Inativar encerra as sessões. */
export async function adminSetEmployeeActive(
  prisma: PrismaClient,
  actor: Actor | null,
  employeeId: string,
  active: boolean,
  ip: string | null,
): Promise<void> {
  assertCan(actor, "user.deactivate");
  await prisma.$transaction(async (tx) => {
    const employee = await tx.employee.update({
      where: { id: employeeId },
      data: { status: active ? "ACTIVE" : "INACTIVE" },
      include: { user: true },
    });
    if (!active && employee.user) {
      if (employee.user.id === actor.id) throw new BusinessError("ERR_FORBIDDEN", "Não é possível inativar a si mesmo.");
      await tx.user.update({ where: { id: employee.user.id }, data: { sessionVersion: { increment: 1 } } });
    }
    await audit(tx, {
      actorId: actor.id,
      action: active ? "USER_REACTIVATED" : "USER_DEACTIVATED",
      entity: "employee",
      entityId: employeeId,
      ip,
    });
  });
}

/**
 * Troca de perfis pelo FPOne Admin (decisão de 29/09/2026). Auditada com antes/depois (RN-RBAC-004,
 * RN-AUD-003). Ninguém altera os próprios perfis (RN-RBAC-005). EMPLOYEE é sempre mantido.
 * Alterar perfis não encerra a sessão: a sessão relê os perfis do banco a cada requisição.
 */
export async function adminSetUserRoles(
  prisma: PrismaClient,
  actor: Actor | null,
  userId: string,
  roles: readonly Role[],
  ip: string | null,
): Promise<void> {
  assertCan(actor, "user.manage_roles");
  if (actor.id === userId) throw new BusinessError("ERR_FORBIDDEN", "Não é possível alterar os próprios perfis.");
  const next = Array.from(new Set<Role>(["EMPLOYEE", ...roles])).sort();
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
    const before = [...user.roles].sort();
    if (before.join() === next.join()) return;
    if (before.includes("ADMIN") && !next.includes("ADMIN")) {
      const admins = await tx.user.count({ where: { roles: { has: "ADMIN" } } });
      if (admins <= 1) throw new BusinessError("ERR_FORBIDDEN", "É preciso manter ao menos um administrador.");
    }
    await tx.user.update({ where: { id: userId }, data: { roles: next } });
    await audit(tx, { actorId: actor.id, action: "ROLE_CHANGED", entity: "user", entityId: userId, metadata: { before, after: next }, ip });
  });
}

/**
 * Bootstrap do primeiro ADMIN (decisão de 29/09/2026). Roda uma única vez: recusa se já existir ADMIN.
 * Executado por linha de comando no servidor (scripts/admin-bootstrap.ts), nunca por HTTP.
 */
export async function bootstrapFirstAdmin(prisma: PrismaClient, matricula: string): Promise<{ userId: string }> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(4242001)`;
      const admins = await tx.user.count({ where: { roles: { has: "ADMIN" } } });
      if (admins > 0) throw new BusinessError("ERR_ADMIN_ALREADY_EXISTS");

      const employee = await tx.employee.findUnique({ where: { matricula }, include: { user: true } });
      if (!employee?.user || employee.status !== "ACTIVE") {
        throw new BusinessError("ERR_VALIDATION", "Matrícula não encontrada ou inativa. Importe o CSV antes.");
      }
      const roles = Array.from(new Set([...employee.user.roles, "ADMIN" as const]));
      await tx.user.update({ where: { id: employee.user.id }, data: { roles } });
      await audit(tx, { actorId: null, action: "ADMIN_BOOTSTRAP", entity: "user", entityId: employee.user.id, metadata: { via: "cli" } });
      await audit(tx, {
        actorId: null,
        action: "ROLE_CHANGED",
        entity: "user",
        entityId: employee.user.id,
        metadata: { before: employee.user.roles, after: roles },
      });
      return { userId: employee.user.id };
    },
  );
}
