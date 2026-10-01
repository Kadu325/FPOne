import Link from "next/link";
import { Pin } from "lucide-react";
import type { ReactNode } from "react";
import { relativeDay } from "@/modules/home/time";
import type { HomeAnnouncement } from "@/modules/home/types";
import { EmptyWidget, SectionHeading } from "./parts";

/**
 * Comunicados da Home (§185): obrigatório fixado no topo. A ciência é confirmada na página do
 * comunicado. Sem link no modo demo (os ids fictícios não existem no banco).
 */
export function Announcements({ items, now, linkable }: { items: HomeAnnouncement[]; now: Date; linkable: boolean }) {
  const [first, ...rest] = items;
  const title = (a: HomeAnnouncement): ReactNode =>
    linkable ? (
      <Link href={`/comunicados/${a.id}`} className="hover:text-brand-emerald">
        {a.title}
      </Link>
    ) : (
      a.title
    );
  return (
    <section aria-labelledby="comunicados-title" className="space-y-5">
      <SectionHeading id="comunicados-title" eyebrow="Comunicados" title="Acontecendo agora" size="text-2xl" />
      {!first ? (
        <EmptyWidget>Nenhum comunicado para você no momento.</EmptyWidget>
      ) : (
        <>
          <article className="rounded-[28px] border border-line bg-white p-6 shadow-card sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              {first.pinned ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-ink px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-white">
                  <Pin className="h-3 w-3" aria-hidden="true" />
                  Fixado
                </span>
              ) : null}
              {first.pendingAcknowledgement ? (
                <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-brand-emerald">Leitura obrigatória</span>
              ) : null}
              <span className="text-xs font-bold text-slate-600">
                {relativeDay(first.publishedAt, now)} · {first.category}
              </span>
            </div>
            <h3 className="mt-4 text-2xl font-extrabold leading-tight text-brand-ink">{title(first)}</h3>
            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-600">{first.summary}</p>
          </article>
          {rest.length > 0 ? (
            <ul className="grid gap-4 md:grid-cols-2">
              {rest.map((a) => (
                <li key={a.id}>
                  <article className="h-full rounded-3xl border border-line bg-white p-5 shadow-card">
                    <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[.1em] text-slate-700">{a.category}</span>
                    <h3 className="mt-3 text-lg font-extrabold leading-snug text-brand-ink">{title(a)}</h3>
                    <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{a.summary}</p>
                    <p className="mt-3 text-xs font-bold text-slate-600">{relativeDay(a.publishedAt, now)}</p>
                  </article>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}
