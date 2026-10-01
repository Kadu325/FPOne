import type { Metadata } from "next";
import { CalendarX, MapPin } from "lucide-react";
import { agendaDayLabel, formatEventRange } from "@/modules/events/format";
import { requireUser } from "@/server/auth/session";
import { loadAudienceSubject } from "@/server/authz/audience";
import { db } from "@/server/db";
import { listAgenda, type EventItem } from "@/server/events/events";

export const metadata: Metadata = { title: "Agenda / Eventos" };
export const dynamic = "force-dynamic";

function groupByDay(items: EventItem[], now: Date): { label: string; items: EventItem[] }[] {
  const groups: { label: string; items: EventItem[] }[] = [];
  for (const e of items) {
    const label = agendaDayLabel(e.startAt, now);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(e);
    else groups.push({ label, items: [e] });
  }
  return groups;
}

function EventCard({ e }: { e: EventItem }) {
  const cancelled = e.status === "CANCELLED";
  return (
    <article className={`rounded-3xl border border-line bg-white p-5 shadow-card ${cancelled ? "opacity-90" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <time dateTime={e.startAt.toISOString()} className="text-sm font-extrabold text-brand-emerald">
          {formatEventRange(e.startAt, e.endAt)}
        </time>
        {cancelled ? (
          <span className="inline-flex items-center gap-1 rounded-md bg-red-50 px-2 py-0.5 text-xs font-extrabold text-red-800">
            <CalendarX className="h-3.5 w-3.5" aria-hidden="true" />
            Cancelado
          </span>
        ) : null}
      </div>
      <h3 className={`mt-2 text-lg font-extrabold text-brand-ink ${cancelled ? "line-through decoration-2" : ""}`}>{e.title}</h3>
      {e.location ? (
        <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-600">
          <MapPin className="h-4 w-4" aria-hidden="true" />
          {e.location}
        </p>
      ) : null}
      {e.description ? <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{e.description}</p> : null}
      {cancelled && e.cancelReason ? <p className="mt-2 text-sm font-semibold text-red-800">Motivo: {e.cancelReason}</p> : null}
    </article>
  );
}

/** Agenda do colaborador (§160): próximos eventos por dia e histórico recente. */
export default async function AgendaPage() {
  const user = await requireUser();
  const now = new Date();
  const subject = await loadAudienceSubject(db(), user.id);
  const { upcoming, past } = subject ? await listAgenda(db(), subject, now) : { upcoming: [], past: [] };

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs font-extrabold uppercase tracking-[.16em] text-brand-emerald">Organização</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-ink">Agenda / Eventos</h1>
      </header>
      <section aria-labelledby="proximos" className="space-y-5">
        <h2 id="proximos" className="text-xl font-extrabold text-brand-ink">
          Próximos eventos
        </h2>
        {upcoming.length === 0 ? (
          <p className="rounded-2xl border border-line bg-white p-6 text-sm text-slate-600 shadow-card">Nenhum evento programado para você.</p>
        ) : (
          groupByDay(upcoming, now).map((g) => (
            <div key={g.label} className="space-y-3">
              <h3 className="text-sm font-extrabold uppercase tracking-[.12em] text-slate-700">{g.label}</h3>
              <ul className="space-y-3">
                {g.items.map((e) => (
                  <li key={e.id}>
                    <EventCard e={e} />
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
      {past.length > 0 ? (
        <section aria-labelledby="anteriores" className="space-y-3">
          <h2 id="anteriores" className="text-xl font-extrabold text-brand-ink">
            Últimos 30 dias
          </h2>
          <ul className="space-y-3">
            {past.map((e) => (
              <li key={e.id}>
                <EventCard e={e} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
