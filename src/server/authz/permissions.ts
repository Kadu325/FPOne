import type { Role } from "@/generated/prisma/enums";

/**
 * Permissões granulares (§18, §170, RN-RBAC-002).
 * Nunca checar perfil direto no código: use can().
 */
export const PERMISSIONS = [
  "admin.access",
  "employee.import",
  "employee.read",
  "user.deactivate",
  "user.manage_roles",
  "audit.read",
  "publication.create",
  "publication.edit",
  "publication.publish",
  "publication.archive",
  "category.manage",
  "analytics.read",
  "employee.update",
  "responsibility.manage",
  "link.manage",
  "event.manage",
  "document.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: PERMISSIONS,
  HR_MANAGER: ["admin.access", "employee.import", "employee.read", "user.deactivate", "employee.update"],
  COMMUNICATION_MANAGER: [
    "admin.access",
    "employee.read",
    "publication.create",
    "publication.edit",
    "publication.publish",
    "publication.archive",
    "category.manage",
    "analytics.read",
    "responsibility.manage",
    "link.manage",
    "event.manage",
    "document.manage",
  ],
  MANAGER: ["employee.read"],
  EMPLOYEE: ["employee.read"],
};
