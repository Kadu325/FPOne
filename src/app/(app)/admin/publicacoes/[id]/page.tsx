import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Unauthorized } from "@/components/feedback/StateMessage";
import { PublicationForm } from "@/components/publications/admin/PublicationForm";
import { ADMIN_NAME } from "@/lib/constants";
import { BusinessError } from "@/lib/errors";
import { toLocalInput } from "@/modules/publications/schema";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/can";
import { db } from "@/server/db";
import { audienceOptions, getForAdmin, listCategories, metricsForAdmin, syncStatuses } from "@/server/publications/admin";

export const metadata: Metadata = { title: "Editar publicação" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditPublicationPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "publication.create")) {
    return (
      <div className="px-4 py-16">
        <Unauthorized />
      </div>
    );
  }
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const now = new Date();
  await syncStatuses(db(), now);
  let p;
  try {
    p = await getForAdmin(db(), user, id, now);
  } catch (e) {
    if (e instanceof BusinessError && e.code === "ERR_NOT_FOUND") notFound();
    throw e;
  }
  const [categories, options, metrics] = await Promise.all([
    listCategories(db()),
    audienceOptions(db(), user),
    can(user, "analytics.read") && p.status !== "DRAFT" ? metricsForAdmin(db(), user, id) : Promise.resolve(null),
  ]);

  const rows = metrics
    ? [
        { label: "Público", value: String(metrics.recipients) },
        { label: "Visualizaram", value: String(metrics.viewed) },
        ...(p.requiresAcknowledgement
          ? [
              { label: "Confirmaram", value: String(metrics.acknowledged) },
              { label: "Pendentes", value: String(metrics.pending) },
            ]
          : []),
        { label: "Taxa de leitura", value: metrics.readRate === null ? "—" : `${metrics.readRate}%` },
        ...(p.requiresAcknowledgement ? [{ label: "Taxa de ciência", value: metrics.ackRate === null ? "—" : `${metrics.ackRate}%` }] : []),
      ]
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <Link href="/admin/publicacoes" className="text-sm font-bold text-brand-emerald hover:underline">
          {ADMIN_NAME} › Publicações
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-ink">{p.title || "Sem título"}</h1>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          Autor: {p.author} · Última edição: {p.lastEditor}
        </p>
      </header>

      {metrics ? (
        <section aria-labelledby="metricas-title" className="rounded-3xl border border-line bg-white p-5 shadow-card">
          <h2 id="metricas-title" className="text-lg font-extrabold text-brand-ink">
            Métricas da versão {p.version}
          </h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {rows.map((r) => (
              <div key={r.label} className="rounded-2xl bg-slate-50 p-3">
                <dt className="text-xs font-bold text-slate-600">{r.label}</dt>
                <dd className="text-xl font-extrabold text-brand-ink">{r.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <PublicationForm
        existing={{ id: p.id, status: p.status, version: p.version }}
        initial={{
          type: p.type,
          title: p.title,
          summary: p.summary,
          content: p.content,
          categoryId: p.categoryId,
          isFeatured: p.isFeatured,
          pinned: p.pinned,
          requiresAcknowledgement: p.requiresAcknowledgement,
          audiences: p.audiences,
          publishAt: p.publishAt ? toLocalInput(p.publishAt) : "",
          expiresAt: p.expiresAt ? toLocalInput(p.expiresAt) : "",
        }}
        categories={categories}
        units={options.units}
        departments={options.departments}
        perms={{ canEdit: can(user, "publication.edit"), canPublish: can(user, "publication.publish"), canArchive: can(user, "publication.archive") }}
      />
    </div>
  );
}
