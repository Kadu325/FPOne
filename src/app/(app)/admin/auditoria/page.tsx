import type { Metadata } from "next";
import Link from "next/link";
import { Unauthorized } from "@/components/feedback/StateMessage";
import { ADMIN_NAME } from "@/lib/constants";
import { serverEnv } from "@/lib/env";
import { ACTION_LABELS, AUDIT_ACTIONS } from "@/modules/audit/labels";
import { formatDateTime } from "@/modules/documents/format";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/can";
import { auditEntities, auditFilterSchema, listAudit, type AuditFilter } from "@/server/audit/query";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Auditoria" };
export const dynamic = "force-dynamic";

const field = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";

/** Trilha de auditoria (§19, §168). Somente leitura e só com audit.read (RN-AUD-004). */
export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireUser();
  if (!can(user, "audit.read")) {
    return (
      <div className="px-4 py-16">
        <Unauthorized />
      </div>
    );
  }
  const raw = await searchParams;
  const parsed = auditFilterSchema.safeParse(raw);
  const filter: AuditFilter = parsed.success ? parsed.data : { action: undefined, entity: undefined, person: undefined };
  const [{ rows, nextBefore }, entities] = await Promise.all([listAudit(db(), user, filter), auditEntities(db())]);
  const query = new URLSearchParams(
    Object.entries({ action: filter.action, entity: filter.entity, person: filter.person, from: filter.from, to: filter.to }).filter((e): e is [string, string] => typeof e[1] === "string"),
  );
  const nextHref = nextBefore ? `/admin/auditoria?${new URLSearchParams([...query, ["before", nextBefore]])}` : null;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm font-bold text-brand-emerald hover:underline">
            {ADMIN_NAME}
          </Link>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-ink">Auditoria</h1>
          <p className="mt-1 text-sm text-slate-600">
            Registros imutáveis. Retenção configurada: {serverEnv().AUDIT_RETENTION_MONTHS} meses (nenhum registro é apagado automaticamente).
          </p>
        </div>
        <a href={`/api/admin/auditoria/export?${query}`} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-800 hover:bg-slate-50">
          Exportar CSV
        </a>
      </header>

      <form className="grid gap-3 rounded-3xl border border-line bg-white p-4 shadow-card sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <div className="lg:col-span-2">
          <label htmlFor="aud-action" className="text-sm font-bold text-brand-ink">
            Ação
          </label>
          <select id="aud-action" name="action" defaultValue={filter.action ?? ""} className={field}>
            <option value="">Todas</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABELS[a]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="aud-entity" className="text-sm font-bold text-brand-ink">
            Entidade
          </label>
          <select id="aud-entity" name="entity" defaultValue={filter.entity ?? ""} className={field}>
            <option value="">Todas</option>
            {entities.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="aud-person" className="text-sm font-bold text-brand-ink">
            Pessoa (nome ou matrícula)
          </label>
          <input id="aud-person" name="person" defaultValue={filter.person ?? ""} maxLength={80} className={field} />
        </div>
        <div>
          <label htmlFor="aud-from" className="text-sm font-bold text-brand-ink">
            De
          </label>
          <input id="aud-from" name="from" type="date" defaultValue={filter.from ?? ""} className={field} />
        </div>
        <div>
          <label htmlFor="aud-to" className="text-sm font-bold text-brand-ink">
            Até
          </label>
          <input id="aud-to" name="to" type="date" defaultValue={filter.to ?? ""} className={field} />
        </div>
        <div className="flex gap-2 lg:col-span-6">
          <button className="rounded-xl bg-brand-ink px-4 py-2 text-sm font-bold text-white hover:bg-brand-emerald">Filtrar</button>
          <Link href="/admin/auditoria" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50">
            Limpar
          </Link>
        </div>
      </form>

      {!parsed.success ? (
        <p role="alert" className="text-sm font-bold text-red-700">
          Filtro inválido; mostrando todos os registros.
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-slate-600 shadow-card">Nenhum registro encontrado.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
          <table className="w-full min-w-[960px] text-left text-sm">
            <caption className="sr-only">Registros de auditoria, do mais recente para o mais antigo</caption>
            <thead className="bg-slate-50 text-xs font-extrabold uppercase tracking-wide text-slate-700">
              <tr>
                <th scope="col" className="px-4 py-3">Data e hora</th>
                <th scope="col" className="px-4 py-3">Ação</th>
                <th scope="col" className="px-4 py-3">Autor</th>
                <th scope="col" className="px-4 py-3">Entidade</th>
                <th scope="col" className="px-4 py-3">IP</th>
                <th scope="col" className="px-4 py-3">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 align-top">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDateTime(r.createdAt)}</td>
                  <td className="px-4 py-3 font-bold text-brand-ink">{r.actionLabel}</td>
                  <td className="px-4 py-3 text-slate-700">{r.actor}</td>
                  <td className="px-4 py-3 text-slate-700">
                    {r.entity}
                    {r.entityId ? <span className="block break-all text-xs text-slate-600">{r.entityId}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{r.ip ?? "—"}</td>
                  <td className="max-w-[360px] px-4 py-3">
                    {r.metadata ? <code className="block whitespace-pre-wrap break-all text-xs text-slate-700">{r.metadata}</code> : <span className="text-slate-600">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {nextHref ? (
        <Link href={nextHref} className="inline-block rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50">
          Registros mais antigos
        </Link>
      ) : null}
    </div>
  );
}
