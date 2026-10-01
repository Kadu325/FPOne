import { ChevronLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { APP_ENV_LABEL, APP_NAME, COMPANY_NAME } from "@/lib/constants";

/**
 * Topo da sidebar: logo (link para a Home, Meu FPOne), empresa e selo do ambiente fora da produção.
 * `onToggle` só existe no desktop (botão na borda); no mobile, `children` traz o "Fechar menu".
 */
export function SidebarBrand({
  collapsed,
  onToggle,
  onNavigate,
  children,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
  children?: ReactNode;
}) {
  const envLabel = APP_ENV_LABEL;

  return (
    <div className={`relative shrink-0 border-b border-slate-100 ${collapsed ? "flex justify-center px-0 pb-4 pt-5" : "px-5 pb-4 pt-6"}`}>
      <div className="flex items-start gap-2">
        <Link href="/" onClick={onNavigate} aria-label={`${APP_NAME}: ir para o início`} className="block rounded-xl">
          {collapsed ? (
            <Image src="/brand/fpone-symbol.png" alt="" width={44} height={44} priority />
          ) : (
            <Image src="/brand/fpone-logo.png" alt="" width={196} height={72} priority className="h-auto w-[196px]" />
          )}
        </Link>
        {children}
      </div>

      {!collapsed ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="whitespace-nowrap border-l-[3px] border-brand-green pl-2.5 text-[12.5px] font-bold leading-tight text-slate-600">
            {COMPANY_NAME}
          </span>
          {envLabel ? (
            <span className="ml-auto whitespace-nowrap rounded-lg bg-amber-50 px-2 py-0.5 text-[11px] font-extrabold text-amber-800">{envLabel}</span>
          ) : null}
        </div>
      ) : null}

      {collapsed && envLabel ? (
        <span
          role="img"
          aria-label={`Ambiente: ${envLabel}`}
          className="absolute right-2.5 top-3 h-2.5 w-2.5 rounded-full bg-amber-500 ring-[3px] ring-white"
        />
      ) : null}

      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          aria-expanded={!collapsed}
          aria-controls="app-sidebar"
          className="absolute -right-3.5 top-9 z-10 hidden h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:text-brand-emerald lg:grid"
        >
          <ChevronLeft className={`h-4 w-4 transition-transform motion-reduce:transition-none ${collapsed ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
