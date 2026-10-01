import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Unauthorized } from "@/components/feedback/StateMessage";
import type { PublicationStatus } from "@/generated/prisma/enums";
import { ADMIN_NAME } from "@/lib/constants";
import { zonedParts } from "@/modules/home/time";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/can";
import { db } from "@/server/db";
import { dashboardForAdmin, listForAdmin } from "@/server/publications/admin";

export const metadata: Metadata = { title: "Publicações" };
export const dynamic = "force-dynamic";

const FILTERS: { value: PublicationStatus | ""; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "DRAFT", label: "Rascunhos" },
  { value: "SCHEDULED", label: "Agendados" },
  { value: "PUBLISHED", label: "Publicados" },
  { value: "ARCHIVED", label: "Arquivados" },
  { value: "EXPIRED", label: "Expirados" },
];
const STATUS_LABEL: Record<PublicationStatus, string> = { DRAFT: "Rascunho", SCHEDULED: "Agendada", PUBLISHED: "Publicada", ARCHIVED: "Arquivada", EXPIRED: "Expirada" };
const dateFmt = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Bahia", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function startOfToday(now: Date): Date {
  const { year, month, day } = zonedParts(now);
  return new Date(Date.UTC(year, month - 1, day, 3, 0));
}

/** Central de Publicações (§68, §79). Só números do banco (RN: sem indicador inventado). */
export default async function PublicationsAdminPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const user = await requireUser();
  if (!can(user, "publication.create")) {
    return (
      <div className="px-4 py-16">
        <Unauthorized />
      </div>
    );
  }
  const { status: rawStatus = "", q = "" } = await searchParams;
  const status = FILTERS.find((f) => f.value === rawStatus)?.value || undefined;
  const now = new Date();
  const [dashboard, rows] = await Promise.all([dashboardForAdmin(db(), user, now, startOfToday(now)), listForAdmin(db(), user, { status, q: q.slice(0, 100) }, now)]);
  const cards = [
    { label: "Publicadas hoje", value: dashboard.publishedToday },
    { label: "Agendadas", value: dashboard.scheduled },
    { label: "Rascunhos", value: dashboard.drafts },
    { label: "Arquivadas", value: dashboard.archived },
    { label: "Aguardando ciência", value: dashboard.awaitingAcknowledgement },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-brand-emerald">{ADMIN_NAME}</p>
          <h1 className="text-3xl font-extrabold tracking-tight text-brand-ink">Publicações</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {can(user, "category.manage") ? (
            <Link href="/admin/publicacoes/categorias" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-800 hover:bg-slate-50">
              Categorias
            </Link>
          ) : null}
          <Link href="/admin/publicacoes/nova" className="inline-flex items-center gap-2 rounded-xl bg-brand-ink px-4 py-2.5 text-sm font-extrabold text-white hover:bg-brand-emerald">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nova publicação
          </Link>
        </div>
      </header>

      <section aria-label="Resumo" className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-line bg-white p-4 shadow-card">
            <p className="text-2xl font-extrabold text-brand-ink">{c.value}</p>
            <p className="mt-1 text-xs font-bold text-slate-600">{c.label}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="lista-title" className="space-y-4">
        <h2 id="lista-title" className="sr-only">
          Lista de publicações
        </h2>
        <form className="flex flex-wrap items-end gap-3" role="search">
          <div>
            <label htmlFor="pub-q" className="block text-sm font-bold text-brand-ink">
              Buscar por título, autor, categoria ou público
            </label>
            <input id="pub-q" name="q" defaultValue={q} className="mt-1 w-72 max-w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
          </div>
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <button className="rounded-xl bg-brand-ink px-4 py-2 text-sm font-bold text-white hover:bg-brand-emerald">Buscar</button>
        </form>
        <nav aria-label="Filtrar por status" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const params = new URLSearchParams({ ...(f.value ? { status: f.value } : {}), ...(q ? { q } : {}) });
            const selected = (status ?? "") === f.value;
            return (
              <Link
                key={f.label}
                href={`/admin/publicacoes${params.size ? `?${params}` : ""}`}
                aria-current={selected ? "page" : undefined}
                className={`rounded-xl px-3.5 py-2 text-xs font-extrabold ${selected ? "bg-brand-ink text-white" : "border border-slate-200 bg-white text-slate-700"}`}
              >
                {f.label}
              </Link>
            );
          })}
        </nav>

        {rows.length === 0 ? (
          <p className="rounded-2xl border border-line bg-white p-6 text-sm font-medium text-slate-600 shadow-card">Nenhuma publicação encontrada.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-slate-50 text-xs font-extrabold uppercase tracking-wide text-slate-700">
                <tr>
                  <th scope="col" className="px-4 py-3">Título</th>
                  <th scope="col" className="px-4 py-3">Categoria</th>
                  <th scope="col" className="px-4 py-3">Autor</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Público</th>
                  <th scope="col" className="px-4 py-3">Publicação</th>
                  <th scope="col" className="px-4 py-3">Visualizações</th>
                  <th scope="col" className="px-4 py-3">Leitura</th>
                  <th scope="col" className="px-4 py-3">Ciência</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-bold text-brand-ink">
                      <Link href={`/admin/publicacoes/${r.id}`} className="hover:text-brand-emerald hover:underline">
                        {r.title || "Sem título"}
                      </Link>
                      <span className="block text-xs font-semibold text-slate-600">{r.type === "NEWS" ? "Novidade" : "Comunicado"}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{r.category ?? "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{r.author}</td>
                    <td className="px-4 py-3 text-slate-700">{STATUS_LABEL[r.status]}</td>
                    <td className="max-w-[220px] px-4 py-3 text-slate-700">{r.audience}</td>
                    <td className="px-4 py-3 text-slate-700">{r.publishAt ? dateFmt.format(r.publishAt) : "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{r.metrics ? r.metrics.viewed : "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{r.metrics?.readRate != null ? `${r.metrics.readRate}%` : "—"}</td>
                    <td className="px-4 py-3 text-slate-700">{r.metrics?.ackRate != null ? `${r.metrics.ackRate}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
