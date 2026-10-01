import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Download, FileText, Megaphone } from "lucide-react";
import { PersonSummary } from "@/components/people/PersonSummary";
import { formatEventRange } from "@/modules/events/format";
import { relativeDay } from "@/modules/home/time";
import { MIN_QUERY_LENGTH } from "@/modules/search/normalize";
import { requireUser } from "@/server/auth/session";
import { recordSearch } from "@/server/analytics/collect";
import { db } from "@/server/db";
import { globalSearch } from "@/server/search/search";

export const metadata: Metadata = { title: "Busca Global" };
export const dynamic = "force-dynamic";

const SUGGESTIONS = ["Fiscal", "Compras", "Quem cuida da infraestrutura?", "Política", "Onboarding"];

/** Busca Global (§101, §163): Pessoas primeiro (§101), depois Documentos, Comunicados e Eventos. */
export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  const { q = "" } = await searchParams;
  const now = new Date();
  const r = await globalSearch(db(), user, q, now);
  const total = r.people.length + r.publications.length + r.documents.length + r.events.length;
  const searched = r.term.length >= MIN_QUERY_LENGTH;
  if (searched) await recordSearch(db(), total);

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs font-extrabold uppercase tracking-[.16em] text-brand-emerald">Inteligência</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-ink">Busca Global</h1>
      </header>

      <form role="search" action="/busca" className="flex flex-wrap items-end gap-3 rounded-3xl border border-line bg-white p-4 shadow-card">
        <div className="min-w-0 flex-1">
          <label htmlFor="busca-q" className="text-sm font-bold text-brand-ink">
            O que você procura?
          </label>
          <input
            id="busca-q"
            name="q"
            type="search"
            defaultValue={q}
            maxLength={200}
            placeholder="Pessoas, documentos, comunicados ou eventos"
            className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900"
          />
        </div>
        <button className="rounded-xl bg-brand-ink px-5 py-2.5 text-sm font-extrabold text-white hover:bg-brand-emerald">Buscar</button>
      </form>

      {r.tooShort ? <p className="text-sm font-semibold text-slate-600">Digite ao menos {MIN_QUERY_LENGTH} letras.</p> : null}

      {searched ? (
        <p role="status" className="text-sm font-semibold text-slate-600">
          {total === 0 ? "Nenhum resultado" : total === 1 ? "1 resultado" : `${total} resultados`} para “{r.term}”.
        </p>
      ) : null}

      {searched && total === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-6 text-sm text-slate-700 shadow-card">
          <p className="font-bold text-brand-ink">Nada encontrado com esses termos.</p>
          <p className="mt-1">Tente uma palavra mais curta ou um assunto, por exemplo:</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <Link href={`/busca?q=${encodeURIComponent(s)}`} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700 hover:border-brand-teal/40">
                  {s}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {r.people.length > 0 ? (
        <section aria-labelledby="res-pessoas" className="space-y-3">
          <h2 id="res-pessoas" className="text-xl font-extrabold text-brand-ink">
            Pessoas
          </h2>
          <ul className="grid gap-4 md:grid-cols-2">
            {r.people.map((p) => (
              <li key={p.id}>
                <PersonSummary person={p} headingLevel={3} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {r.documents.length > 0 ? (
        <section aria-labelledby="res-docs" className="space-y-3">
          <h2 id="res-docs" className="text-xl font-extrabold text-brand-ink">
            Documentos
          </h2>
          <ul className="divide-y divide-slate-100 rounded-3xl border border-line bg-white shadow-card">
            {r.documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 p-4">
                <FileText className="h-5 w-5 shrink-0 text-brand-blue" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-extrabold text-brand-ink">{d.title}</h3>
                  <p className="text-xs font-semibold text-slate-600">
                    {d.category} · Versão {d.version}
                  </p>
                </div>
                <a href={`/api/documentos/${d.id}/download`} className="inline-flex items-center gap-2 text-sm font-bold text-brand-blue hover:underline">
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Baixar<span className="sr-only"> {d.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {r.publications.length > 0 ? (
        <section aria-labelledby="res-pubs" className="space-y-3">
          <h2 id="res-pubs" className="text-xl font-extrabold text-brand-ink">
            Comunicados e novidades
          </h2>
          <ul className="divide-y divide-slate-100 rounded-3xl border border-line bg-white shadow-card">
            {r.publications.map((p) => (
              <li key={p.id} className="flex gap-3 p-4">
                <Megaphone className="mt-0.5 h-5 w-5 shrink-0 text-brand-emerald" aria-hidden="true" />
                <div className="min-w-0">
                  <h3 className="font-extrabold text-brand-ink">
                    <Link href={`/${p.type === "NEWS" ? "novidades" : "comunicados"}/${p.id}`} className="hover:text-brand-emerald hover:underline">
                      {p.title}
                    </Link>
                  </h3>
                  <p className="text-xs font-semibold text-slate-600">
                    {p.type === "NEWS" ? "Novidade" : "Comunicado"} · {relativeDay(p.publishedAt, now)}
                    {p.pendingAcknowledgement ? " · Ciência pendente" : ""}
                  </p>
                  {p.summary ? <p className="mt-1 text-sm text-slate-700">{p.summary}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {r.events.length > 0 ? (
        <section aria-labelledby="res-eventos" className="space-y-3">
          <h2 id="res-eventos" className="text-xl font-extrabold text-brand-ink">
            Eventos
          </h2>
          <ul className="divide-y divide-slate-100 rounded-3xl border border-line bg-white shadow-card">
            {r.events.map((e) => (
              <li key={e.id} className="flex gap-3 p-4">
                <CalendarDays className="mt-0.5 h-5 w-5 shrink-0 text-brand-emerald" aria-hidden="true" />
                <div className="min-w-0">
                  <h3 className="font-extrabold text-brand-ink">
                    <Link href="/agenda" className="hover:text-brand-emerald hover:underline">
                      {e.title}
                    </Link>
                  </h3>
                  <p className="text-xs font-semibold text-slate-600">
                    {formatEventRange(e.startAt, e.endAt)}
                    {e.location ? ` · ${e.location}` : ""}
                    {e.status === "CANCELLED" ? " · Cancelado" : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
