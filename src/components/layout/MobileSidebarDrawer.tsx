"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { NavSection } from "@/modules/navigation/nav";
import { SidebarFooter } from "./SidebarFooter";
import { SidebarBrand } from "./SidebarBrand";
import { SidebarNav } from "./SidebarNav";
import type { ShellUser } from "./shell-types";

/**
 * Drawer mobile (§88). <dialog> modal: prende o foco, fecha com ESC e devolve o foco ao botão
 * que abriu. Fecha pelo botão, pelo backdrop e ao escolher um item; bloqueia o scroll do body.
 */
export function MobileSidebarDrawer(props: {
  open: boolean;
  onClose: () => void;
  user: ShellUser;
  navigation: readonly NavSection[];
  showAdminNav: boolean;
  pathname: string;
}) {
  const { open, onClose } = props;
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      id="mobile-sidebar"
      aria-label="Menu"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-y-0 left-0 m-0 h-full max-h-none w-[min(272px,85vw)] max-w-none bg-transparent p-0 backdrop:bg-brand-ink/45 lg:hidden"
    >
      <div className="flex h-full flex-col bg-white shadow-soft">
        <SidebarBrand collapsed={false} onNavigate={onClose}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar menu"
            className="ml-auto grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-600"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </SidebarBrand>
        <SidebarNav navigation={props.navigation} showAdminNav={props.showAdminNav} pathname={props.pathname} collapsed={false} onNavigate={onClose} />
        <SidebarFooter user={props.user} collapsed={false} />
      </div>
    </dialog>
  );
}
