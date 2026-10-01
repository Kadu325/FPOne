import type { Role } from "@/generated/prisma/enums";
import { BusinessError } from "@/lib/errors";
import { ROLE_PERMISSIONS, type Permission } from "./permissions";

export interface Actor {
  id: string;
  roles: readonly Role[];
}

/** Única fonte de decisão de autorização (RN-CORE-001). */
export function can(actor: Actor | null | undefined, permission: Permission): boolean {
  if (!actor) return false;
  return actor.roles.some((role) => ROLE_PERMISSIONS[role].includes(permission));
}

/** Lança ERR_UNAUTHORIZED sem ator e ERR_FORBIDDEN sem permissão. */
export function assertCan(actor: Actor | null | undefined, permission: Permission): asserts actor is Actor {
  if (!actor) throw new BusinessError("ERR_UNAUTHORIZED");
  if (!can(actor, permission)) throw new BusinessError("ERR_FORBIDDEN");
}
