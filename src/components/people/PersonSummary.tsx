import Link from "next/link";
import { Mail } from "lucide-react";
import { initials } from "@/lib/initials";
import type { PersonCard } from "@/server/people/directory";

/**
 * Resultado do diretório (§100): foto (iniciais até existir foto corporativa), nome, cargo,
 * departamento, unidade, responsabilidades, e-mail e ação para abrir o perfil. Sem dado fictício
 * (RN-DIR-005): contato ausente aparece como "não informado".
 */
export function PersonSummary({ person, headingLevel = 2 }: { person: PersonCard; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  return (
    <article className="flex h-full flex-col gap-4 rounded-3xl border border-line bg-white p-5 shadow-card">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="brand-gradient grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-sm font-extrabold text-white">
          {initials(person.name)}
        </span>
        <div className="min-w-0">
          <Heading className="text-base font-extrabold leading-snug text-brand-ink">
            <Link href={`/pessoas/${person.id}`} className="hover:text-brand-emerald">
              {person.name}
            </Link>
          </Heading>
          <p className="text-sm font-semibold text-slate-700">{person.jobTitle}</p>
          <p className="text-xs font-semibold text-slate-600">
            {person.department} · {person.unit}
          </p>
        </div>
      </div>
      {person.responsibilities.length > 0 ? (
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[.12em] text-brand-emerald">Responsável por</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {person.responsibilities.slice(0, 6).map((r) => (
              <li key={r.id} className="rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-brand-emerald">
                {r.responsibility}
                {r.isPrimary ? null : <span className="font-semibold text-slate-600"> (apoio)</span>}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="mt-auto flex flex-wrap items-center gap-3 text-sm">
        {person.corporateEmail ? (
          <a href={`mailto:${person.corporateEmail}`} className="inline-flex items-center gap-1.5 font-bold text-brand-blue hover:underline">
            <Mail className="h-4 w-4" aria-hidden="true" />
            Enviar e-mail<span className="sr-only"> para {person.name}</span>
          </a>
        ) : (
          <span className="text-slate-600">E-mail não informado</span>
        )}
        <Link href={`/pessoas/${person.id}`} className="font-bold text-brand-emerald hover:underline">
          Ver perfil<span className="sr-only"> de {person.name}</span>
        </Link>
      </div>
    </article>
  );
}
