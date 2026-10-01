import type { NavSection } from "@/modules/navigation/nav";
import { SidebarFooter } from "./SidebarFooter";
import { SidebarBrand } from "./SidebarBrand";
import { SidebarNav } from "./SidebarNav";
import type { ShellUser } from "./shell-types";

/** Sidebar fixa do desktop (§83–85). No mobile, o mesmo conteúdo vai para o MobileSidebarDrawer. */
export function Sidebar(props: {
  user: ShellUser;
  navigation: readonly NavSection[];
  showAdminNav: boolean;
  pathname: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const { collapsed } = props;
  return (
    <aside
      id="app-sidebar"
      aria-label="Menu lateral"
      className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-slate-200 bg-white shadow-[12px_0_40px_rgba(15,23,42,.06)] transition-[width] duration-300 lg:flex ${
        collapsed ? "w-[84px]" : "w-[272px]"
      }`}
    >
      <SidebarBrand collapsed={collapsed} onToggle={props.onToggle} />
      <SidebarNav navigation={props.navigation} showAdminNav={props.showAdminNav} pathname={props.pathname} collapsed={collapsed} />
      <SidebarFooter user={props.user} collapsed={collapsed} />
    </aside>
  );
}
