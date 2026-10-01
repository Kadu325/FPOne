import { ADMIN_NAME } from "@/lib/constants";
import { ADMIN_NAVIGATION, type NavSection } from "@/modules/navigation/nav";
import { SidebarSection } from "./SidebarSection";

/** Corpo da navegação, compartilhado entre a sidebar desktop e o drawer mobile (mesma ordem, §119). */
export function SidebarNav({
  navigation,
  showAdminNav,
  pathname,
  collapsed,
  onNavigate,
}: {
  navigation: readonly NavSection[];
  showAdminNav: boolean;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const inAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  return (
    <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-3 py-5">
      {navigation.map((s) => (
        <SidebarSection key={s.id} id={s.id} label={s.label} items={s.items} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
      ))}
      {showAdminNav && inAdmin ? (
        <SidebarSection id="admin-context" label={ADMIN_NAME} items={ADMIN_NAVIGATION} pathname={pathname} collapsed={collapsed} onNavigate={onNavigate} />
      ) : null}
    </nav>
  );
}
