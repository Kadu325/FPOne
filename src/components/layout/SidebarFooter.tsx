import type { ShellUser } from "./shell-types";

export function SidebarFooter({ user, collapsed }: { user: ShellUser; collapsed: boolean }) {
  return (
    <div className="shrink-0 border-t border-slate-100 p-3">
      <div className={`flex items-center gap-3 rounded-2xl p-2 ${collapsed ? "justify-center" : ""}`}>
        <span aria-hidden="true" className="brand-gradient grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-extrabold text-white">
          {user.initials}
        </span>
        <div className={collapsed ? "sr-only" : "min-w-0 flex-1"}>
          <p className="truncate text-xs font-extrabold text-slate-800">{user.name}</p>
          <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-600">{user.department}</p>
        </div>
      </div>
    </div>
  );
}
