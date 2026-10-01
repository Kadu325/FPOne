import type { Metadata } from "next";
import { PersonSummary } from "@/components/people/PersonSummary";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { directoryFilters, searchDirectory } from "@/server/people/directory";

export const metadata: Metadata = { title: "Colaboradores" };
export const dynamic = "force-dynamic";

const field = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900";

/** Diretório Inteligente (§98–100, RN-DIR-001): nome, cargo, departamento, unidade, responsabilidade. */
export default async function DirectoryPage({ searchParams }: { searchParams: Promise<{ q?: string; unidade?: string; departamento?: string }> }) {
  const user = await requireUser();
  const { q = "", unidade = "", departamento = "" } = await searchParams;
  const filters = await directoryFilters(db());
  const unit = filters.units.includes(unidade) ? unidade : undefined;
  const department = filters.departments.includes(departamento) ? departamento : undefined;
  const { items, term } = await searchDirectory(db(), user, { q: q.slice(0, 200), unit, department });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs font-extrabold uppercase tracking-[.16em] text-brand-emerald">Pessoas</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-ink">Colaboradores</h1>
        <p className="mt-2 text-sm font-medium text-slate-600">Encontre pessoas por nome, cargo, departamento, unidade ou pelo assunto de que cuidam.</p>
      </header>

      <form role="search" className="grid gap-3 rounded-3xl border border-line bg-white p-4 shadow-card sm:grid-cols-[1fr_200px_200px_auto] sm:items-end">
        <div>
          <label htmlFor="dir-q" className="text-sm font-bold text-brand-ink">
            Buscar
          </label>
          <input id="dir-q" name="q" type="search" defaultValue={q} placeholder="Ex.: Fiscal, Compras, quem cuida da infraestrutura?" className={field} />
        </div>
        <div>
          <label htmlFor="dir-unit" className="text-sm font-bold text-brand-ink">
            Unidade
          </label>
          <select id="dir-unit" name="unidade" defaultValue={unit ?? ""} className={field}>
            <option value="">Todas</option>
            {filters.units.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="dir-dep" className="text-sm font-bold text-brand-ink">
            Departamento
          </label>
          <select id="dir-dep" name="departamento" defaultValue={department ?? ""} className={field}>
            <option value="">Todos</option>
            {filters.departments.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </div>
        <button className="rounded-xl bg-brand-ink px-5 py-2.5 text-sm font-extrabold text-white hover:bg-brand-emerald">Buscar</button>
      </form>

      {term ? (
        <p role="status" className="text-sm font-semibold text-slate-600">
          {items.length === 0 ? "Nenhum resultado" : items.length === 1 ? "1 resultado" : `${items.length} resultados`} para “{term}”.
        </p>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-6 text-sm text-slate-600 shadow-card">
          <p className="font-bold text-brand-ink">Ninguém encontrado.</p>
          <p className="mt-1">Tente um termo mais curto, sem filtros, ou pelo nome do departamento. Responsabilidades aparecem quando cadastradas pelo FPOne Admin.</p>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((p) => (
            <li key={p.id}>
              <PersonSummary person={p} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
