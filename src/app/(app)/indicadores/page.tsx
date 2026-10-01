import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Unauthorized } from "@/components/feedback/StateMessage";
import { formatDay, formatNumber, formatPeriod, parsePeriod, PERIODS } from "@/modules/analytics/kpi";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/can";
import { db } from "@/server/db";
import { kpiReport } from "@/server/analytics/kpis";

export const metadata: Metadata = { title: "Indicadores" };
export const dynamic = "force-dynamic";

const INSUFFICIENT = "Ainda não há dados suficientes";

/** Número real ou o estado vazio (§187, RN-KPI-007). Nunca zero inventado para taxa sem base. */
function Value({ value, suffix = "" }: { value: number | null; suffix?: string }) {
  if (value === null) return <p className="text-sm font-bold text-slate-600">{INSUFFICIENT}</p>;
  return (
    <p className="text-3xl font-extrabold tracking-tight text-brand-ink">
      {formatNumber(value)}
      {suffix}
    </p>
  );
}

function Kpi({ label, value, suffix, note }: { label: string; value: number | null; suffix?: string; note?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-card">
      <p className="text-xs font-extrabold uppercase tracking-[.12em] text-slate-700">{label}</p>
      <div className="mt-2">
        <Value value={value} suffix={suffix} />
      </div>
      {note ? <p className="mt-1 text-xs font-semibold text-slate-600">{note}</p> : null}
    </div>
  );
}

function Group({ id, title, children, note }: { id: string; title: string; children: ReactNode; note?: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div>
        <h2 id={id} className="text-xl font-extrabold text-brand-ink">
          {title}
        </h2>
        {note ? <p className="text-sm text-slate-600">{note}</p> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

/** Indicadores (§43, §164): só agregados, com período e população-base explícitos. */
export default async function IndicatorsPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const user = await requireUser();
  if (!can(user, "analytics.read")) {
    return (
      <div className="px-4 py-16">
        <Unauthorized />
      </div>
    );
  }
  const days = parsePeriod((await searchParams).periodo);
  const r = await kpiReport(db(), user, days, new Date());
  const period = formatPeriod(r.window);

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[.16em] text-brand-emerald">Inteligência</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-ink">Indicadores</h1>
          <p className="mt-2 text-sm font-medium text-slate-600">
            Período: <strong className="text-brand-ink">{period}</strong> ({days} dias, horário da Bahia) · população-base: {formatNumber(r.population)} colaboradores ativos
          </p>
        </div>
        <nav aria-label="Período" className="flex gap-2">
          {PERIODS.map((p) => (
            <Link
              key={p}
              href={`/indicadores?periodo=${p}`}
              aria-current={p === days ? "page" : undefined}
              className={`rounded-xl px-3.5 py-2 text-xs font-extrabold ${p === days ? "bg-brand-ink text-white" : "border border-slate-200 bg-white text-slate-700"}`}
            >
              {p} dias
            </Link>
          ))}
        </nav>
      </header>

      <Group
        id="kpi-uso"
        title="Uso"
        note={r.collectingSince ? `Usuário ativo = abriu a intranet ao menos uma vez no dia (coleta desde ${formatDay(r.collectingSince)}).` : "A coleta de atividade começa no primeiro acesso após esta versão."}
      >
        <Kpi label="Ativos no período" value={r.activity?.periodActive ?? null} note={r.activity?.activeRate != null ? `${r.activity.activeRate}% da população-base` : undefined} />
        <Kpi label="DAU (hoje)" value={r.activity?.dau ?? null} />
        <Kpi label="WAU (7 dias)" value={r.activity?.wau ?? null} />
        <Kpi label="MAU (30 dias)" value={r.activity?.mau ?? null} />
        <Kpi label="Taxa de retorno" value={r.activity?.returnRate ?? null} suffix="%" note="Ativos no período anterior que voltaram neste" />
      </Group>

      <Group id="kpi-comunicacao" title="Comunicação" note="Publicações publicadas no período; taxas sobre destinatários válidos da versão vigente (RN-KPI-002/003).">
        <Kpi label="Publicadas" value={r.publications.published} />
        <Kpi label="Primeiras visualizações" value={r.publications.views} />
        <Kpi label="Taxa de leitura" value={r.publications.readRate} suffix="%" note={r.publications.recipients > 0 ? `${formatNumber(r.publications.viewed)} de ${formatNumber(r.publications.recipients)} destinatários` : undefined} />
        <Kpi
          label="Taxa de ciência"
          value={r.publications.ackRate}
          suffix="%"
          note={r.publications.ackRecipients > 0 ? `${formatNumber(r.publications.acknowledged)} de ${formatNumber(r.publications.ackRecipients)} com ciência exigida` : undefined}
        />
      </Group>

      <Group id="kpi-conhecimento" title="Conhecimento e busca">
        <Kpi label="Downloads de documentos" value={r.documents.downloads} note={`${formatNumber(r.documents.distinctDocuments)} documentos diferentes`} />
        <Kpi label="Buscas realizadas" value={r.searches.total} />
        <Kpi label="Buscas sem resultado" value={r.searches.withoutResultsRate} suffix="%" note={r.searches.total > 0 ? `${formatNumber(r.searches.withoutResults)} de ${formatNumber(r.searches.total)}` : undefined} />
        <Kpi label="Cliques em links úteis" value={r.links.clicks} />
      </Group>

      <section aria-labelledby="kpi-links" className="rounded-3xl border border-line bg-white p-5 shadow-card">
        <h2 id="kpi-links" className="text-lg font-extrabold text-brand-ink">
          Links mais usados no período
        </h2>
        {r.links.top.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">{INSUFFICIENT}.</p>
        ) : (
          <ol className="mt-3 space-y-1 text-sm text-slate-800">
            {r.links.top.map((l) => (
              <li key={l.label} className="flex justify-between gap-4">
                <span className="font-semibold">{l.label}</span>
                <span className="font-extrabold text-brand-ink">{formatNumber(l.clicks)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
