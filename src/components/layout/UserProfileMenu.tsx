"use client";

import Link from "next/link";
import { ChevronDown, LogOut, UserRound } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import type { ShellUser } from "./shell-types";
import { usePopover } from "./usePopover";

/** Menu do perfil no topbar (§89). O perfil exibido vem do servidor, nunca de seletor no cliente. */
export function UserProfileMenu({ user }: { user: ShellUser }) {
  const { open, setOpen, toggle, rootRef, buttonRef } = usePopover();
  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls="profile-panel"
        aria-label={`Perfil de ${user.name}`}
        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-1.5 transition hover:border-brand-teal/40 sm:pr-2.5"
      >
        <span aria-hidden="true" className="brand-gradient grid h-9 w-9 place-items-center rounded-xl text-xs font-extrabold text-white">
          {user.initials}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block text-xs font-extrabold text-slate-800">{user.name}</span>
          <span className="mt-0.5 block text-[11px] font-semibold text-slate-600">{user.roleLabel}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-slate-600 sm:block" aria-hidden="true" />
      </button>
      {open ? (
        <section
          id="profile-panel"
          aria-label="Meu perfil"
          className="absolute right-0 top-14 z-50 w-[min(300px,calc(100vw-2rem))] rounded-3xl border border-slate-200 bg-white p-4 shadow-soft"
        >
          <p className="text-sm font-extrabold text-brand-ink">{user.name}</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-600">{user.department}</p>
          <p className="mt-2 inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-brand-emerald">{user.roleLabel}</p>
          <Link href="/perfil" onClick={() => setOpen(false)} className="mt-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-brand-emerald hover:bg-slate-50">
            <UserRound className="h-4 w-4" aria-hidden="true" />
            Ver perfil completo
          </Link>
          <form action={logoutAction} className="mt-2 border-t border-slate-100 pt-3">
            <button className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50">
              <LogOut className="h-4 w-4" aria-hidden="true" />
              Sair
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
