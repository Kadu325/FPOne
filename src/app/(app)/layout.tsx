import { cookies } from "next/headers";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { SIDEBAR_COOKIE } from "@/components/layout/shell-types";
import { isDemoMode } from "@/lib/flags";
import { visibleNavigation } from "@/modules/navigation/nav";
import { can } from "@/server/authz/can";
import { requireUser } from "@/server/auth/session";
import { initials, loadShellDepartment, primaryRoleLabel } from "@/server/auth/shell-profile";
import { recordActivity } from "@/server/analytics/collect";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";

/** Área autenticada: toda página aqui passa pelo AppShell. A navegação é filtrada no servidor (§86). */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const [department, cookieStore] = await Promise.all([loadShellDepartment(db(), user.id), cookies(), recordActivity(db(), user.id, new Date())]);
  return (
    <AppShell
      user={{ name: user.name, initials: initials(user.name), roleLabel: primaryRoleLabel(user.roles), department }}
      navigation={visibleNavigation((p) => can(user, p))}
      showAdminNav={can(user, "admin.access")}
      initialCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "collapsed"}
      demo={isDemoMode()}
    >
      {children}
    </AppShell>
  );
}
