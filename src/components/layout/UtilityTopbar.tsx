import { Menu } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationCenter } from "./NotificationCenter";
import { UserProfileMenu } from "./UserProfileMenu";
import type { ShellUser } from "./shell-types";

/** Topbar só com utilidades (§83, §89, §117): menu mobile, contexto, busca, notificações e perfil. */
export function UtilityTopbar({
  user,
  pageLabel,
  demo,
  drawerOpen,
  onOpenDrawer,
}: {
  user: ShellUser;
  pageLabel: string;
  demo: boolean;
  drawerOpen: boolean;
  onOpenDrawer: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 h-20 border-b border-white/70 bg-white/85 backdrop-blur-lg">
      <div className="flex h-full items-center gap-3 px-4 sm:px-6 lg:px-7">
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label="Abrir menu"
          aria-expanded={drawerOpen}
          aria-controls="mobile-sidebar"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 lg:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="hidden text-[10px] font-extrabold uppercase tracking-[.15em] text-slate-600 sm:block">{APP_NAME}</p>
            {demo ? <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-[.08em] text-amber-900">Demo</span> : null}
          </div>
          <p className="mt-0.5 truncate text-sm font-extrabold text-slate-800">{pageLabel}</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <GlobalSearch />
          <NotificationCenter />
          <UserProfileMenu user={user} />
        </div>
      </div>
    </header>
  );
}
