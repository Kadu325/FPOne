import Link from "next/link";
import { Pin } from "lucide-react";
import { relativeDay } from "@/modules/home/time";
import type { FeedItem } from "@/server/publications/feed";

/** Lista do feed (§78). Só recebe o que o servidor já filtrou por audiência e vigência. */
export function PublicationList({ items, basePath, now, emptyText }: { items: FeedItem[]; basePath: string; now: Date; emptyText: string }) {
  if (items.length === 0) {
    return <p className="rounded-2xl border border-line bg-white p-6 text-sm font-medium text-slate-600 shadow-card">{emptyText}</p>;
  }
  return (
    <ul className="space-y-4">
      {items.map((p) => (
        <li key={p.id}>
          <article className="rounded-3xl border border-line bg-white p-5 shadow-card transition hover:border-brand-teal/40 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              {p.pinned ? (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-brand-ink px-2 py-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-white">
                  <Pin className="h-3 w-3" aria-hidden="true" />
                  Fixado
                </span>
              ) : null}
              {p.pendingAcknowledgement ? (
                <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-brand-emerald">Ciência pendente</span>
              ) : null}
              {p.category ? <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[.1em] text-slate-700">{p.category}</span> : null}
              <span className="text-xs font-bold text-slate-600">{relativeDay(p.publishedAt, now)}</span>
            </div>
            <h2 className="mt-3 text-xl font-extrabold leading-snug text-brand-ink">
              <Link href={`${basePath}/${p.id}`} className="hover:text-brand-emerald">
                {p.title}
              </Link>
            </h2>
            {p.summary ? <p className="mt-2 text-sm font-medium leading-6 text-slate-600">{p.summary}</p> : null}
          </article>
        </li>
      ))}
    </ul>
  );
}
