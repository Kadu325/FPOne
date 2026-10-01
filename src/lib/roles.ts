import type { Role } from "@/generated/prisma/enums";

/** Nomes de exibição dos perfis. */
export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Administrador",
  COMMUNICATION_MANAGER: "Gestor de comunicação",
  HR_MANAGER: "Gestor de RH",
  MANAGER: "Gestor",
  EMPLOYEE: "Colaborador",
};

/** Perfis atribuíveis no Admin (EMPLOYEE é sempre mantido). */
export const ASSIGNABLE_ROLES: readonly Role[] = ["ADMIN", "COMMUNICATION_MANAGER", "HR_MANAGER", "MANAGER"];
