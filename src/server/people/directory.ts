import type { PrismaClient, Prisma } from "@/generated/prisma/client";
import { BusinessError } from "@/lib/errors";
import { likeEscape, MIN_QUERY_LENGTH, normalizeQuery } from "@/modules/search/normalize";
import { daysUntilBirthday } from "@/modules/home/time";
import { assertCan, can, type Actor } from "@/server/authz/can";

/**
 * Perfil Corporativo + Diretório (§94–108, RN-PROF-*, RN-DIR-*). Só dados corporativos:
 * nunca CPF, PIN, matrícula ou ano de nascimento (RN-PROF-004, §102).
 */

export interface PersonCard {
  id: string;
  name: string;
  jobTitle: string;
  department: string;
  unit: string;
  corporateEmail: string | null;
  corporatePhone: string | null;
  active: boolean;
  responsibilities: { id: string; responsibility: string; keywords: string[]; isPrimary: boolean }[];
}

const cardSelect = {
  id: true,
  name: true,
  jobTitle: true,
  department: true,
  unit: true,
  corporateEmail: true,
  corporatePhone: true,
  status: true,
  responsibilities: { select: { id: true, responsibility: true, keywords: true, isPrimary: true }, orderBy: [{ isPrimary: "desc" }, { responsibility: "asc" }] },
} satisfies Prisma.EmployeeSelect;

type CardRow = Prisma.EmployeeGetPayload<{ select: typeof cardSelect }>;

function toCard(r: CardRow): PersonCard {
  return {
    id: r.id,
    name: r.name,
    jobTitle: r.jobTitle,
    department: r.department,
    unit: r.unit,
    corporateEmail: r.corporateEmail,
    corporatePhone: r.corporatePhone,
    active: r.status === "ACTIVE",
    responsibilities: r.responsibilities,
  };
}

export interface DirectoryFilter {
  q?: string;
  unit?: string;
  department?: string;
}

const PAGE = 50;

/**
 * Ranking (RN-DIR-002, RN-SRC-004): exato em responsabilidade/nome → parcial em nome/responsabilidade
 * → cargo/departamento → palavras-chave → unidade. Sem acento e sem caixa (unaccent + lower).
 */
async function rankedIds(prisma: PrismaClient, term: string): Promise<string[]> {
  const pattern = `%${likeEscape(term)}%`;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT e.id
    FROM "employee" e
    LEFT JOIN "employee_responsibility" r ON r.employee_id = e.id
    WHERE e.status = 'ACTIVE' AND (
      unaccent(lower(e.name)) LIKE ${pattern}
      OR unaccent(lower(e.job_title)) LIKE ${pattern}
      OR unaccent(lower(e.department)) LIKE ${pattern}
      OR unaccent(lower(e.unit)) LIKE ${pattern}
      OR unaccent(lower(r.responsibility)) LIKE ${pattern}
      OR EXISTS (SELECT 1 FROM unnest(r.keywords) k WHERE unaccent(lower(k)) LIKE ${pattern})
    )
    GROUP BY e.id, e.name
    ORDER BY MAX(CASE
      WHEN unaccent(lower(r.responsibility)) = ${term} OR unaccent(lower(e.name)) = ${term} THEN 100
      WHEN unaccent(lower(e.name)) LIKE ${pattern} OR unaccent(lower(r.responsibility)) LIKE ${pattern} THEN 60
      WHEN unaccent(lower(e.job_title)) LIKE ${pattern} OR unaccent(lower(e.department)) LIKE ${pattern} THEN 40
      WHEN EXISTS (SELECT 1 FROM unnest(r.keywords) k WHERE unaccent(lower(k)) LIKE ${pattern}) THEN 30
      ELSE 20 END) DESC, e.name ASC
    LIMIT ${PAGE}`;
  return rows.map((r) => r.id);
}

/** Diretório: só ativos (RN-PROF-001, RN-DIR-006). Consulta com menos de 2 caracteres é ignorada (RN-SRC-003). */
export async function searchDirectory(prisma: PrismaClient, actor: Actor, filter: DirectoryFilter): Promise<{ items: PersonCard[]; term: string }> {
  assertCan(actor, "employee.read");
  const term = normalizeQuery(filter.q ?? "");
  const where: Prisma.EmployeeWhereInput = {
    status: "ACTIVE",
    ...(filter.unit ? { unit: filter.unit } : {}),
    ...(filter.department ? { department: filter.department } : {}),
  };
  if (term.length < MIN_QUERY_LENGTH) {
    const rows = await prisma.employee.findMany({ where, select: cardSelect, orderBy: { name: "asc" }, take: PAGE });
    return { items: rows.map(toCard), term: "" };
  }
  const ids = await rankedIds(prisma, term);
  if (ids.length === 0) return { items: [], term };
  const rows = await prisma.employee.findMany({ where: { ...where, id: { in: ids } }, select: cardSelect });
  const order = new Map(ids.map((id, i) => [id, i]));
  return { items: rows.map(toCard).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0)), term };
}

/** Busca global usa o mesmo ranking, com limite menor. */
export async function searchPeople(prisma: PrismaClient, actor: Actor, term: string, limit: number): Promise<PersonCard[]> {
  const { items } = await searchDirectory(prisma, actor, { q: term });
  return items.slice(0, limit);
}

/** Perfil: inativo só com permissão administrativa (RN-PROF-007, RN-DIR-006). */
export async function getProfile(prisma: PrismaClient, actor: Actor, employeeId: string): Promise<PersonCard> {
  assertCan(actor, "employee.read");
  const row = await prisma.employee.findUnique({ where: { id: employeeId }, select: cardSelect });
  if (!row || (row.status !== "ACTIVE" && !can(actor, "admin.access"))) throw new BusinessError("ERR_NOT_FOUND");
  return toCard(row);
}

export async function ownEmployeeId(prisma: PrismaClient, userId: string): Promise<string | null> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { employeeId: true } });
  return u?.employeeId ?? null;
}

export async function directoryFilters(prisma: PrismaClient): Promise<{ units: string[]; departments: string[] }> {
  const [units, departments] = await Promise.all([
    prisma.employee.findMany({ where: { status: "ACTIVE" }, distinct: ["unit"], select: { unit: true }, orderBy: { unit: "asc" } }),
    prisma.employee.findMany({ where: { status: "ACTIVE" }, distinct: ["department"], select: { department: true }, orderBy: { department: "asc" } }),
  ]);
  return { units: units.map((u) => u.unit), departments: departments.map((d) => d.department) };
}

export interface BirthdayPerson {
  id: string;
  name: string;
  department: string;
  unit: string;
  day: number;
  month: number;
  daysUntil: number;
}

/** Aniversariantes ativos na janela, no fuso corporativo (RN-BDAY-001..004). Só dia e mês. */
export async function upcomingBirthdays(prisma: PrismaClient, now: Date, windowDays: number): Promise<BirthdayPerson[]> {
  const months = new Set<number>();
  for (let d = 0; d < windowDays; d += 1) {
    const date = new Date(now.getTime() + d * 86_400_000);
    months.add(Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/Bahia", month: "numeric" }).format(date)));
  }
  const rows = await prisma.employee.findMany({
    where: { status: "ACTIVE", birthMonth: { in: [...months] }, birthDay: { not: null } },
    select: { id: true, name: true, department: true, unit: true, birthDay: true, birthMonth: true },
  });
  return rows
    .map((r) => ({ id: r.id, name: r.name, department: r.department, unit: r.unit, day: r.birthDay ?? 0, month: r.birthMonth ?? 0 }))
    .map((r) => ({ ...r, daysUntil: daysUntilBirthday(r.day, r.month, now) }))
    .filter((r) => r.daysUntil < windowDays)
    .sort((a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name, "pt-BR"));
}
