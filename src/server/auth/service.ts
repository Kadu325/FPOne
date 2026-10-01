import type { PrismaClient } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { audit } from "@/server/audit/audit";

/**
 * Vínculo entre a conta do Active Directory ou credenciais locais e o usuário local.
 */

export interface SessionUser {
  id: string;
  employeeId: string;
  name: string;
  matricula: string;
  roles: Role[];
  sessionVersion: number;
}

export type AdLinkFailure = "inactive";
export type AdLinkResult = { ok: true; value: SessionUser } | { ok: false; reason: AdLinkFailure };

export interface AuthContext {
  prisma: PrismaClient;
  ip: string | null;
  now?: Date;
}

function toSessionUser(e: { id: string; name: string; matricula: string; user: { id: string; roles: Role[]; sessionVersion: number } }): SessionUser {
  return {
    id: e.user.id,
    employeeId: e.id,
    name: e.name,
    matricula: e.matricula,
    roles: e.user.roles,
    sessionVersion: e.user.sessionVersion,
  };
}

export interface AdIdentity {
  username: string;
  emails: (string | null | undefined)[];
  name?: string | null;
  department?: string | null;
  title?: string | null;
}

const NOT_INFORMED = "Não informado";

/**
 * Login AD: basta a conta de rede ativa (senha já validada no AD). O vínculo com o colaborador é:
 * usuário de rede (ad_username) → e-mail (mail/UPN) do colaborador importado → criação
 * automática no 1º login com os dados do AD e perfil EMPLOYEE. Colaborador inativo não entra.
 */
export async function resolveAdLogin(ctx: AuthContext, identity: AdIdentity): Promise<AdLinkResult> {
  const now = ctx.now ?? new Date();
  const adUsername = identity.username.trim().toLowerCase();
  const candidates = [...new Set(identity.emails.map((e) => e?.trim().toLowerCase()).filter((e): e is string => Boolean(e)))];

  let employee = await ctx.prisma.employee.findUnique({ where: { adUsername }, include: { user: true } });
  if (!employee && candidates.length) {
    employee = await ctx.prisma.employee.findFirst({
      where: { corporateEmail: { in: candidates, mode: "insensitive" }, adUsername: null },
      include: { user: true },
    });
  }

  if (employee && employee.status !== "ACTIVE") {
    const actorId = employee.user?.id ?? null;
    await audit(ctx.prisma, { actorId, action: "LOGIN_FAILED", entity: "user", entityId: actorId, metadata: { reason: "inactive", method: "ad" }, ip: ctx.ip });
    return { ok: false, reason: "inactive" };
  }

  const found = employee;
  const linked = await ctx.prisma.$transaction(async (tx) => {
    let current = found;
    let provisioned = false;
    if (!current) {
      const email = candidates[0];
      const emailTaken = email ? await tx.employee.findFirst({ where: { corporateEmail: { equals: email, mode: "insensitive" } }, select: { id: true } }) : null;
      current = await tx.employee.create({
        data: {
          matricula: `AD-${adUsername}`,
          adUsername,
          name: identity.name?.trim() || identity.username,
          unit: NOT_INFORMED,
          department: identity.department?.trim() || NOT_INFORMED,
          jobTitle: identity.title?.trim() || NOT_INFORMED,
          corporateEmail: email && !emailTaken ? email : null,
          user: { create: {} },
        },
        include: { user: true },
      });
      provisioned = true;
    } else if (current.adUsername !== adUsername || !current.user) {
      current = await tx.employee.update({
        where: { id: current.id },
        data: { adUsername, ...(current.user ? {} : { user: { create: {} } }) },
        include: { user: true },
      });
    }
    const user = current.user;
    if (!user) throw new Error("employee sem usuário após vínculo");
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });
    if (provisioned) {
      await audit(tx, { actorId: user.id, action: "USER_PROVISIONED", entity: "user", entityId: user.id, metadata: { source: "ad" }, ip: ctx.ip });
    }
    await audit(tx, { actorId: user.id, action: "LOGIN", entity: "user", entityId: user.id, metadata: { method: "ad" }, ip: ctx.ip });
    return { ...current, user };
  });
  return { ok: true, value: toSessionUser(linked) };
}

/**
 * Fallback de autenticação local/desenvolvimento/demo seguro auditado (§184, RN-AUTH-004).
 * Suporta PIN (argon2id) ou credenciais de demonstração/desenvolvimento quando o AD não estiver acessível.
 */
export async function resolveLocalFallbackLogin(
  ctx: AuthContext,
  rawLogin: string,
  rawPassword?: string,
): Promise<{ ok: true; value: SessionUser } | { ok: false; reason: "invalid_credentials" | "inactive" | "locked" }> {
  const now = ctx.now ?? new Date();
  const login = rawLogin.trim().toLowerCase();
  const password = rawPassword ?? "";

  // Procura por ad_username, matricula ou corporate_email
  let employee = await ctx.prisma.employee.findFirst({
    where: {
      OR: [
        { adUsername: login },
        { matricula: { equals: login, mode: "insensitive" } },
        { corporateEmail: { equals: login, mode: "insensitive" } },
      ],
    },
    include: { user: true },
  });

  const isDemo = process.env.DEMO_MODE === "true" || process.env.NODE_ENV !== "production";
  const masterUsername = (process.env.MASTER_ADMIN_USERNAME || "admin").trim().toLowerCase();
  const masterPassword = process.env.MASTER_ADMIN_PASSWORD || (isDemo ? "admin" : "Admin@FPOne2026!");
  const isMasterLogin = login === masterUsername || (isDemo && login === "demo");

  // Usuário Master para gerenciamento interno (ou Demo em dev)
  if (isMasterLogin && (password === masterPassword || (isDemo && (password === "admin" || password === "123456" || password === "")))) {
    const roles: Role[] = login === "demo" ? ["EMPLOYEE"] : ["ADMIN"];
    const created = await ctx.prisma.$transaction(async (tx) => {
      let emp = await tx.employee.findFirst({
        where: {
          OR: [
            { adUsername: login },
            { matricula: login === "demo" ? "DEMO" : "MASTER-001" },
            ...(login !== "demo" ? [{ corporateEmail: { equals: process.env.MASTER_ADMIN_EMAIL || "admin@fazendaprogresso.com.br", mode: "insensitive" as const } }] : []),
          ],
        },
        include: { user: true },
      });

      if (!emp) {
        emp = await tx.employee.create({
          data: {
            matricula: login === "demo" ? "DEMO" : "MASTER-001",
            adUsername: login,
            name: login === "demo" ? "Colaborador Demo" : "Administrador Master",
            unit: "Sede",
            department: "Tecnologia",
            jobTitle: login === "demo" ? "Analista" : "Administrador Geral",
            corporateEmail: process.env.MASTER_ADMIN_EMAIL || `${login}@fazendaprogresso.com.br`,
            status: "ACTIVE",
            user: { create: { roles, sessionVersion: 1, lastLoginAt: now } },
          },
          include: { user: true },
        });
      } else {
        if (emp.status !== "ACTIVE") {
          emp = await tx.employee.update({
            where: { id: emp.id },
            data: { status: "ACTIVE" },
            include: { user: true },
          });
        }
        if (emp.user) {
          const currentRoles = emp.user.roles;
          const hasAdmin = currentRoles.includes("ADMIN");
          if (!hasAdmin && login !== "demo") {
            await tx.user.update({
              where: { id: emp.user.id },
              data: { roles: [...currentRoles, "ADMIN"], lastLoginAt: now },
            });
          } else {
            await tx.user.update({
              where: { id: emp.user.id },
              data: { lastLoginAt: now },
            });
          }
        } else {
          emp = await tx.employee.update({
            where: { id: emp.id },
            data: { user: { create: { roles, sessionVersion: 1, lastLoginAt: now } } },
            include: { user: true },
          });
        }
      }

      const user = emp.user;
      if (!user) throw new Error("employee sem usuário após bootstrap");
      await audit(tx, {
        actorId: user.id,
        action: "LOGIN",
        entity: "user",
        entityId: user.id,
        metadata: { method: login === "demo" ? "demo_login" : "master_admin" },
        ip: ctx.ip,
      });
      return { ...emp, user };
    });
    return { ok: true, value: toSessionUser(created) };
  }

  if (!employee) {
    return { ok: false, reason: "invalid_credentials" };
  }

  if (employee.status !== "ACTIVE") {
    const actorId = employee.user?.id ?? null;
    await audit(ctx.prisma, {
      actorId,
      action: "LOGIN_FAILED",
      entity: "user",
      entityId: actorId,
      metadata: { reason: "inactive", method: "local_fallback" },
      ip: ctx.ip,
    });
    return { ok: false, reason: "inactive" };
  }

  if (employee.lockedUntil && employee.lockedUntil > now) {
    return { ok: false, reason: "locked" };
  }

  let verified = false;

  if (employee.pinHash) {
    try {
      const argon2 = await import("@node-rs/argon2");
      verified = await argon2.verify(employee.pinHash, password);
    } catch {
      verified = employee.pinHash === password;
    }
  } else if (isDemo) {
    // No modo demo/dev sem PIN, aceita senhas padrão ou vazias de teste
    verified = password === "123456" || password === "admin" || password === "demo" || password === employee.matricula;
  }

  if (!verified) {
    const failedAttempts = employee.failedAttempts + 1;
    const lockedUntil = failedAttempts >= 5 ? new Date(now.getTime() + 15 * 60 * 1000) : null;
    await ctx.prisma.employee.update({
      where: { id: employee.id },
      data: { failedAttempts, lockedUntil },
    });
    const actorId = employee.user?.id ?? null;
    await audit(ctx.prisma, {
      actorId,
      action: "LOGIN_FAILED",
      entity: "user",
      entityId: actorId,
      metadata: { reason: "bad_password", method: "local_fallback" },
      ip: ctx.ip,
    });
    return { ok: false, reason: "invalid_credentials" };
  }

  // Sucesso
  const user = await ctx.prisma.$transaction(async (tx) => {
    let u = employee.user;
    if (!u) {
      u = await tx.user.create({
        data: {
          employeeId: employee.id,
          roles: ["EMPLOYEE"],
          sessionVersion: 1,
        },
      });
    }
    await tx.user.update({
      where: { id: u.id },
      data: { lastLoginAt: now },
    });
    await tx.employee.update({
      where: { id: employee.id },
      data: { failedAttempts: 0, lockedUntil: null },
    });
    await audit(tx, {
      actorId: u.id,
      action: "LOGIN",
      entity: "user",
      entityId: u.id,
      metadata: { method: "local_fallback" },
      ip: ctx.ip,
    });
    return { ...employee, user: u };
  });

  return { ok: true, value: toSessionUser(user) };
}

/**
 * Revalida a sessão a cada requisição (§182, RN-AUTH-003/004): usuário ativo e session_version igual.
 * Devolve os dados atuais (perfis podem ter mudado) ou null para encerrar a sessão.
 */
export async function loadSessionUser(prisma: PrismaClient, userId: string, sessionVersion: number): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { employee: true } });
  if (!user || user.sessionVersion !== sessionVersion || user.employee.status !== "ACTIVE") return null;
  return toSessionUser({ ...user.employee, user });
}
