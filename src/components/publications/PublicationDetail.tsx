import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { relativeDay } from "@/modules/home/time";
import type { FeedDetail } from "@/server/publications/feed";
import { AcknowledgeButton } from "./AcknowledgeButton";
import { RichContent } from "./RichContent";

/** Leitura de comunicado ou novidade. O CTA de ciência aparece até o usuário confirmar (RN-ACK-001). */
export function PublicationDetail({ item, backHref, backLabel, now }: { item: FeedDetail; backHref: string; backLabel: string; now: Date }) {
  return (
    <article className="mx-auto max-w-3xl space-y-6 px-4 py-8 sm:px-6">
      <Link href={backHref} className="inline-flex items-center gap-2 text-sm font-bold text-brand-emerald hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {backLabel}
      </Link>
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {item.requiresAcknowledgement ? (
            <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-brand-emerald">Leitura obrigatória</span>
          ) : null}
          {item.category ? <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[.1em] text-slate-700">{item.category}</span> : null}
          <span className="text-xs font-bold text-slate-600">{relativeDay(item.publishedAt, now)}</span>
        </div>
        <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-brand-ink sm:text-4xl">{item.title}</h1>
        {item.summary ? <p className="text-lg font-medium leading-7 text-slate-600">{item.summary}</p> : null}
      </header>
      <div className="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-8">
        <RichContent doc={item.content} />
      </div>
      {item.requiresAcknowledgement ? <AcknowledgeButton id={item.id} acknowledged={!item.pendingAcknowledgement} /> : null}
    </article>
  );
}
