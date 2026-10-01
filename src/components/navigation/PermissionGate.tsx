import "server-only";
import type { ReactNode } from "react";
import { can, type Actor } from "@/server/authz/can";
import type { Permission } from "@/server/authz/permissions";

/**
 * Renderiza os filhos só com a permissão (§86). É cosmética de interface: a ação ou página
 * protegida continua checando can()/assertCan() no servidor (RN-CORE-001).
 */
export function PermissionGate({ actor, permission, children, fallback = null }: { actor: Actor | null; permission: Permission; children: ReactNode; fallback?: ReactNode }) {
  return can(actor, permission) ? children : fallback;
}
