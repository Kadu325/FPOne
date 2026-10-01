import Link from "next/link";
import type { NavItem } from "@/modules/navigation/nav";
import { NavIcon } from "./NavIcon";

/** Item da sidebar (§84, §90). Recolhido: só o ícone, com tooltip visível no hover/foco (§118). */
export function SidebarItem({ item, active, collapsed, onNavigate }: { item: NavItem; active: boolean; collapsed: boolean; onNavigate?: () => void }) {
  const base = "group relative flex items-center gap-3 rounded-2xl py-2.5 text-sm font-bold transition";
  const layout = collapsed ? "justify-center px-1.5" : "px-3";
  const label = collapsed ? <span className="sr-only">{item.label}</span> : <span className="truncate">{item.label}</span>;
  const tooltip = collapsed ? (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-lg bg-brand-ink px-2.5 py-1.5 text-xs font-bold text-white shadow-card group-hover:block group-focus-visible:block"
    >
      {item.ready ? item.label : `${item.label} · em breve`}
    </span>
  ) : null;

  if (!item.ready) {
    return (
      <span aria-disabled="true" className={`${base} ${layout} cursor-not-allowed text-slate-500`}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-50 text-slate-500">
          <NavIcon name={item.icon} />
        </span>
        {label}
        {collapsed ? (
          <span className="sr-only">(em breve)</span>
        ) : (
          <span className="ml-auto rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">Em breve</span>
        )}
        {tooltip}
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={`${base} ${layout} ${active ? "sidebar-active text-brand-emerald" : "text-slate-600 hover:bg-slate-50 hover:text-brand-emerald"}`}
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${active ? "sidebar-active-icon text-white" : "bg-slate-50 text-slate-600"}`}>
        <NavIcon name={item.icon} />
      </span>
      {label}
      {tooltip}
    </Link>
  );
}
