import { ArrowUpRight, Link2 } from "lucide-react";
import type { HomeLink } from "@/modules/home/types";
import { EmptyWidget, SectionHeading } from "./parts";

/** Links úteis (§185, §162): cadastrados no FPOne Admin; substituem os atalhos de módulos. */
export function UsefulLinks({ links, showHeading = true }: { links: HomeLink[]; showHeading?: boolean }) {
  return (
    <section aria-labelledby={showHeading ? "links-title" : undefined} aria-label={showHeading ? undefined : "Links úteis"} className="space-y-5">
      {showHeading ? <SectionHeading id="links-title" eyebrow="Acesso rápido" title="Links úteis" size="text-2xl" /> : null}
      {links.length === 0 ? (
        <EmptyWidget>Nenhum link útil cadastrado ainda.</EmptyWidget>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {links.map((l) => {
            const body = (
              <>
                <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-brand-emerald">
                  <Link2 className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold text-brand-ink">{l.label}</span>
                  <span className="block truncate text-xs font-semibold text-slate-600">{l.description}</span>
                </span>
              </>
            );
            const cls = "flex h-full items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-card";
            return (
              <li key={l.id}>
                {l.href && !l.external ? (
                  <a href={l.href} className={`${cls} transition hover:border-brand-teal/40`}>
                    {body}
                  </a>
                ) : l.href ? (
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className={`${cls} transition hover:border-brand-teal/40`}>
                    {body}
                    <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-600" aria-hidden="true" />
                    <span className="sr-only">(abre em nova aba)</span>
                  </a>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
