"use client";

import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { currentPageLabel } from "@/modules/navigation/nav";
import { MobileBottomNav } from "./MobileBottomNav";
import { MobileSidebarDrawer } from "./MobileSidebarDrawer";
import { Sidebar } from "./Sidebar";
import { UtilityTopbar } from "./UtilityTopbar";
import { SIDEBAR_COOKIE, type ShellProps } from "./shell-types";

const ONE_YEAR = 60 * 60 * 24 * 365;

/** AppShell (§84, §93): sidebar fixa/recolhível no desktop, drawer + barra inferior no mobile. */
export function AppShell({ user, navigation, showAdminNav, initialCollapsed, demo, children }: ShellProps & { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "expanded"}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
  };

  return (
    <>
      <a
        href="#conteudo"
        className="sr-only z-[100] rounded-xl bg-brand-ink px-4 py-2 text-sm font-bold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Pular para o conteúdo
      </a>
      <Sidebar user={user} navigation={navigation} showAdminNav={showAdminNav} pathname={pathname} collapsed={collapsed} onToggle={toggle} />
      <MobileSidebarDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        user={user}
        navigation={navigation}
        showAdminNav={showAdminNav}
        pathname={pathname}
      />
      <div className={`min-w-0 lg:transition-[padding] lg:duration-300 ${collapsed ? "lg:pl-[84px]" : "lg:pl-[272px]"}`}>
        <UtilityTopbar
          user={user}
          pageLabel={currentPageLabel(pathname, navigation)}
          demo={demo}
          drawerOpen={drawerOpen}
          onOpenDrawer={() => setDrawerOpen(true)}
        />
        <main id="conteudo" tabIndex={-1} className="min-h-[calc(100vh-5rem)] pb-24 outline-none lg:pb-0">
          {children}
        </main>
      </div>
      <MobileBottomNav navigation={navigation} pathname={pathname} />
    </>
  );
}
