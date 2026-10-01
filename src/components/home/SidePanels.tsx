import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { birthdayLabel, timeOfDay } from "@/modules/home/time";
import type { HomeBirthday, HomeEvent } from "@/modules/home/types";
import { initials } from "@/lib/initials";
import { Card, EmptyWidget, SectionHeading } from "./parts";

/** Agenda de hoje (§185, coluna lateral). */
export function TodayAgenda({ events, linkable = false }: { events: HomeEvent[]; linkable?: boolean }) {
  return (
    <Card aria-labelledby="agenda-hoje-title">
      <SectionHeading id="agenda-hoje-title" eyebrow="Agenda" title="Hoje">
        <span aria-hidden="true" className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-brand-emerald">
          <CalendarDays className="h-5 w-5" />
        </span>
      </SectionHeading>
      <div className="mt-4">
        {events.length === 0 ? (
          <EmptyWidget>Nenhum evento para hoje.</EmptyWidget>
        ) : (
          <ol className="space-y-3">
            {events.map((e) => (
              <li key={e.id} className="flex gap-3 rounded-2xl bg-slate-50 p-3">
                <time dateTime={e.startsAt.toISOString()} className="w-14 shrink-0 text-sm font-extrabold text-brand-emerald">
                  {timeOfDay(e.startsAt)}
                </time>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-brand-ink">{e.title}</p>
                  <p className="text-xs font-semibold text-slate-600">{e.location}</p>
                </div>
              </li>
            ))}
          </ol>
        )}
        {linkable ? (
          <Link href="/agenda" className="mt-4 inline-block text-sm font-bold text-brand-emerald hover:underline">
            Abrir agenda completa
          </Link>
        ) : null}
      </div>
    </Card>
  );
}

/** Aniversariantes dos próximos dias. Só dia e mês; nunca a idade ou o ano (LGPD). */
export function Birthdays({ people, now }: { people: HomeBirthday[]; now: Date }) {
  return (
    <Card aria-labelledby="aniversariantes-title">
      <SectionHeading id="aniversariantes-title" eyebrow="Pessoas" title="Aniversariantes">
        {people.length > 0 ? (
          <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-extrabold text-brand-emerald">{people.length === 1 ? "1 esta semana" : `${people.length} esta semana`}</span>
        ) : null}
      </SectionHeading>
      <div className="mt-4">
        {people.length === 0 ? (
          <EmptyWidget>Nenhum aniversariante nos próximos dias.</EmptyWidget>
        ) : (
          <ul className="space-y-3">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-3">
                <span aria-hidden="true" className="brand-gradient grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xs font-extrabold text-white">
                  {initials(p.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-extrabold text-brand-ink">{p.name}</p>
                  <p className="truncate text-xs font-semibold text-slate-600">
                    {p.department} · {p.unit}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-extrabold text-brand-emerald">{birthdayLabel(p.day, p.month, now)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
