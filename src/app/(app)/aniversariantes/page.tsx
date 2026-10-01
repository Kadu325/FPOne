import type { Metadata } from "next";
import Link from "next/link";
import { initials } from "@/lib/initials";
import { birthdayLabel } from "@/modules/home/time";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { upcomingBirthdays } from "@/server/people/directory";

export const metadata: Metadata = { title: "Aniversariantes" };
export const dynamic = "force-dynamic";

const WINDOW_DAYS = 30;

/** Aniversariantes dos próximos 30 dias (RN-BDAY-001..004): só dia e mês, só ativos. */
export default async function BirthdaysPage() {
  await requireUser();
  const now = new Date();
  const people = await upcomingBirthdays(db(), now, WINDOW_DAYS);
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs font-extrabold uppercase tracking-[.16em] text-brand-emerald">Pessoas</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-ink">Aniversariantes</h1>
        <p className="mt-2 text-sm font-medium text-slate-600">Próximos {WINDOW_DAYS} dias.</p>
      </header>
      {people.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-sm font-medium text-slate-600 shadow-card">Nenhum aniversariante nos próximos {WINDOW_DAYS} dias.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-3xl border border-line bg-white shadow-card">
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-4">
              <span aria-hidden="true" className="brand-gradient grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xs font-extrabold text-white">
                {initials(p.name)}
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/pessoas/${p.id}`} className="block truncate text-sm font-extrabold text-brand-ink hover:text-brand-emerald">
                  {p.name}
                </Link>
                <p className="truncate text-xs font-semibold text-slate-600">
                  {p.department} · {p.unit}
                </p>
              </div>
              <span className="shrink-0 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-extrabold text-brand-emerald">{birthdayLabel(p.day, p.month, now)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
