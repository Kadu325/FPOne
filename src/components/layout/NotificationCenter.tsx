"use client";

import { Bell } from "lucide-react";
import { usePopover } from "./usePopover";

/**
 * Central de notificações no topbar (§110). Ainda não há fonte de notificações:
 * mostra o estado vazio real, sem contador nem itens fictícios.
 */
export function NotificationCenter() {
  const { open, toggle, rootRef, buttonRef } = usePopover();
  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="notification-panel"
        aria-label="Notificações"
        className="grid h-11 w-11 place-items-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition hover:text-brand-emerald"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
      </button>
      {open ? (
        <section
          id="notification-panel"
          aria-labelledby="notification-title"
          className="absolute right-0 top-14 z-50 w-[min(360px,calc(100vw-2rem))] rounded-3xl border border-slate-200 bg-white p-4 shadow-soft"
        >
          <p className="text-xs font-bold uppercase tracking-[.16em] text-brand-emerald">Central</p>
          <h2 id="notification-title" className="mt-1 text-lg font-extrabold text-brand-ink">
            Notificações
          </h2>
          <p className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-600">Você não tem notificações.</p>
        </section>
      ) : null}
    </div>
  );
}
