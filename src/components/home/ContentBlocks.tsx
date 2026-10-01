import Link from "next/link";
import { FileText, Sparkles } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { relativeDay } from "@/modules/home/time";
import type { HomeDocument, HomeNews } from "@/modules/home/types";
import { Card, EmptyWidget, SectionHeading } from "./parts";

/** Novidades (§183, §185): conteúdo leve, nunca exige ciência. */
export function NewsList({ items, now, linkable }: { items: HomeNews[]; now: Date; linkable: boolean }) {
  return (
    <section aria-labelledby="novidades-title" className="space-y-5">
      <SectionHeading id="novidades-title" eyebrow="O que há de novo" title="Novidades" size="text-2xl sm:text-3xl" />
      {items.length === 0 ? (
        <EmptyWidget>Nenhuma novidade publicada ainda.</EmptyWidget>
      ) : (
        <ul className="grid gap-4 md:grid-cols-3">
          {items.map((n) => (
            <li key={n.id}>
              <article className="flex h-full flex-col rounded-3xl border border-line bg-white p-5 shadow-card">
                <span className="self-start rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[.1em] text-slate-700">{n.category}</span>
                <h3 className="mt-3 text-lg font-extrabold leading-snug text-brand-ink">
                  {linkable ? (
                    <Link href={`/novidades/${n.id}`} className="hover:text-brand-emerald">
                      {n.title}
                    </Link>
                  ) : (
                    n.title
                  )}
                </h3>
                <p className="mt-2 flex-1 text-sm font-medium leading-6 text-slate-600">{n.summary}</p>
                <p className="mt-4 text-xs font-bold text-slate-600">{relativeDay(n.publishedAt, now)}</p>
              </article>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function RecentDocuments({ items, now, linkable = false }: { items: HomeDocument[]; now: Date; linkable?: boolean }) {
  return (
    <Card aria-labelledby="documentos-title">
      <SectionHeading id="documentos-title" eyebrow="Conhecimento" eyebrowClass="text-brand-blue" title="Documentos recentes" size="text-2xl">
        {linkable ? (
          <Link href="/documentos" className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-extrabold text-slate-700 hover:border-brand-teal/40">
            Ver biblioteca
          </Link>
        ) : null}
      </SectionHeading>
      <div className="mt-5">
        {items.length === 0 ? (
          <EmptyWidget>Nenhum documento recente.</EmptyWidget>
        ) : (
          <ul className="space-y-3">
            {items.map((d) => (
              <li key={d.id} className="flex items-center gap-3 rounded-2xl bg-slate-50 p-3">
                <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-brand-blue">
                  <FileText className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-brand-ink">
                    {linkable ? (
                      <a href={`/api/documentos/${d.id}/download`} className="hover:text-brand-emerald hover:underline">
                        {d.title}
                      </a>
                    ) : (
                      d.title
                    )}
                    {d.isNew ? <span className="ml-2 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-extrabold text-brand-emerald">Novo</span> : null}
                  </p>
                  <p className="text-xs font-semibold text-slate-600">
                    {d.area} · Versão {d.version} · {relativeDay(d.updatedAt, now).toLowerCase()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

/** Busca inteligente: "Em breve" enquanto FEATURE_AI_SEARCH estiver desligada (§185). Sem formulário ativo. */
export function SmartSearchTeaser() {
  return (
    <section aria-labelledby="busca-ia-title" className="relative overflow-hidden rounded-3xl bg-brand-ink p-6 text-white shadow-card sm:p-7">
      <div className="flex items-center gap-2">
        <p className="text-xs font-extrabold uppercase tracking-[.16em] text-brand-lime">Busca inteligente</p>
        <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-extrabold text-white/90">Em breve</span>
      </div>
      <h2 id="busca-ia-title" className="mt-3 text-2xl font-extrabold">
        Pergunte à {APP_NAME}
      </h2>
      <p className="mt-3 text-sm font-medium leading-6 text-white/80">
        Encontre políticas, procedimentos, comunicados e documentos fazendo uma pergunta.
      </p>
      <div className="mt-5 flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-medium text-white/70">
        <Sparkles className="h-4 w-4 shrink-0 text-brand-lime" aria-hidden="true" />
        Qual é o fluxo para solicitar uma compra?
      </div>
    </section>
  );
}
