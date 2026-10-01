import Link from "next/link";
import { BOTTOM_NAV_IDS, BOTTOM_NAV_LABELS, findNavItem, isActive, type NavSection } from "@/modules/navigation/nav";
import { NavIcon } from "./NavIcon";

/** Barra inferior fixa no mobile (§185): Início, Comunicados, Pessoas, Buscar. Complementa o drawer. */
export function MobileBottomNav({ navigation, pathname }: { navigation: readonly NavSection[]; pathname: string }) {
  const items = BOTTOM_NAV_IDS.flatMap((id) => {
    const item = findNavItem(id, navigation);
    return item ? [{ ...item, label: BOTTOM_NAV_LABELS[id] }] : [];
  });
  return (
    <nav
      aria-label="Navegação rápida"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="grid grid-cols-4">
        {items.map((item) => {
          const cls = "flex flex-col items-center gap-1 py-2.5 text-[11px] font-extrabold";
          if (!item.ready) {
            return (
              <li key={item.id}>
                <span aria-disabled="true" className={`${cls} text-slate-500`}>
                  <NavIcon name={item.icon} className="h-5 w-5" />
                  {item.label}
                  <span className="sr-only">(em breve)</span>
                </span>
              </li>
            );
          }
          const active = isActive(item.href, pathname);
          return (
            <li key={item.id}>
              <Link href={item.href} aria-current={active ? "page" : undefined} className={`${cls} ${active ? "text-brand-emerald" : "text-slate-600"}`}>
                <NavIcon name={item.icon} className="h-5 w-5" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
