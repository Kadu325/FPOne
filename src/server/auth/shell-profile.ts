import type { PrismaClient } from "@/generated/prisma/client";
import type { Role } from "@/generated/prisma/enums";
import { ROLE_LABELS } from "@/lib/roles";

/** Ordem de exibição do perfil principal no topbar: o mais amplo primeiro. */
const ROLE_ORDER: readonly Role[] = ["ADMIN", "COMMUNICATION_MANAGER", "HR_MANAGER", "MANAGER", "EMPLOYEE"];

export function primaryRoleLabel(roles: readonly Role[]): string {
  const role = ROLE_ORDER.find((r) => roles.includes(r)) ?? "EMPLOYEE";
  return ROLE_LABELS[role];
}

export { initials } from "@/lib/initials";

/** Departamento do usuário para o rodapé da sidebar e o menu de perfil. */
export async function loadShellDepartment(prisma: PrismaClient, userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { employee: { select: { department: true } } } });
  return user?.employee.department ?? "";
}
