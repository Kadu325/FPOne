import type { NavItem } from "@/modules/navigation/nav";
import { isActive } from "@/modules/navigation/nav";
import { SidebarItem } from "./SidebarItem";

export function SidebarSection({
  id,
  label,
  items,
  pathname,
  collapsed,
  onNavigate,
}: {
  id: string;
  label: string | null;
  items: readonly NavItem[];
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const headingId = `nav-${id}`;
  return (
    <div className={label ? (collapsed ? "mt-4" : "mt-6") : undefined}>
      {label ? (
        <p id={headingId} className={collapsed ? "sr-only" : "px-3 text-[10px] font-extrabold uppercase tracking-[.16em] text-slate-500"}>
          {label}
        </p>
      ) : null}
      <ul className={label ? "mt-2 space-y-1" : "space-y-1"} aria-labelledby={label ? headingId : undefined}>
        {items.map((item) => (
          <li key={item.id}>
            <SidebarItem item={item} active={isActive(item.href, pathname)} collapsed={collapsed} onNavigate={onNavigate} />
          </li>
        ))}
      </ul>
    </div>
  );
}
