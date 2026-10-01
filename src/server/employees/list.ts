import type { PrismaClient } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { assertCan, type Actor } from "@/server/authz/can";

export interface EmployeeListItem {
  id: string;
  userId: string | null;
  matricula: string;
  name: string;
  unit: string;
  department: string;
  status: "ACTIVE" | "INACTIVE";
  hasCorporateEmail: boolean;
  roles: Role[];
}

/** Lista para o FPOne Admin. Nunca seleciona cpf_hash nem pin_hash (§102). */
export async function listEmployeesForAdmin(
  prisma: PrismaClient,
  actor: Actor | null,
  query: string,
): Promise<{ items: EmployeeListItem[]; total: number }> {
  assertCan(actor, "admin.access");
  const q = query.trim().slice(0, 80);
  const where = q
    ? { OR: [{ matricula: { contains: q } }, { name: { contains: q, mode: "insensitive" as const } }] }
    : {};
  const [rows, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      orderBy: { name: "asc" },
      take: 50,
      select: {
        id: true,
        matricula: true,
        name: true,
        unit: true,
        department: true,
        status: true,
        corporateEmail: true,
        user: { select: { id: true, roles: true } },
      },
    }),
    prisma.employee.count({ where }),
  ]);
  return {
    total,
    items: rows.map((r) => ({
      id: r.id,
      userId: r.user?.id ?? null,
      matricula: r.matricula,
      name: r.name,
      unit: r.unit,
      department: r.department,
      status: r.status,
      hasCorporateEmail: r.corporateEmail !== null,
      roles: r.user?.roles ?? [],
    })),
  };
}
