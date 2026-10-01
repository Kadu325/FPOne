import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, Phone } from "lucide-react";
import { CopyContact } from "@/components/people/CopyContact";
import { BusinessError } from "@/lib/errors";
import { initials } from "@/lib/initials";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/can";
import { db } from "@/server/db";
import { getProfile, type PersonCard } from "@/server/people/directory";

export const metadata: Metadata = { title: "Perfil corporativo" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Perfil Corporativo (§105, §107). Só dados corporativos (RN-PROF-004). */
export default async function ProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  let p: PersonCard;
  try {
    p = await getProfile(db(), user, id);
  } catch (e) {
    if (e instanceof BusinessError && e.code === "ERR_NOT_FOUND") notFound();
    throw e;
  }
  const contact = [p.name, p.jobTitle, `${p.department} · ${p.unit}`, p.corporateEmail, p.corporatePhone].filter(Boolean).join("\n");
  const canManage = can(user, "responsibility.manage") || can(user, "employee.update");

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <Link href="/pessoas" className="inline-flex items-center gap-2 text-sm font-bold text-brand-emerald hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Colaboradores
      </Link>

      <header className="flex flex-col gap-5 rounded-[28px] bg-brand-ink p-6 text-white shadow-soft sm:flex-row sm:items-center sm:p-8">
        <span aria-hidden="true" className="brand-gradient grid h-20 w-20 shrink-0 place-items-center rounded-3xl text-2xl font-extrabold text-white">
          {initials(p.name)}
        </span>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">{p.name}</h1>
          <p className="mt-1 text-base font-bold text-white">{p.jobTitle}</p>
          <p className="text-sm font-semibold text-white/90">
            {p.department} · {p.unit}
          </p>
          {!p.active ? <p className="mt-2 inline-flex rounded-lg bg-white/15 px-2 py-1 text-xs font-bold">Inativo</p> : null}
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section aria-labelledby="contato-title" className="rounded-3xl border border-line bg-white p-5 shadow-card">
          <h2 id="contato-title" className="text-lg font-extrabold text-brand-ink">
            Contato
          </h2>
          <dl className="mt-3 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-bold text-slate-600">E-mail corporativo</dt>
              <dd className="font-semibold text-slate-800">{p.corporateEmail ?? "Não informado"}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-slate-600">Telefone corporativo</dt>
              <dd className="font-semibold text-slate-800">{p.corporatePhone ?? "Não informado"}</dd>
            </div>
          </dl>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {p.corporateEmail ? (
              <a href={`mailto:${p.corporateEmail}`} className="inline-flex items-center gap-2 rounded-xl bg-brand-ink px-4 py-2.5 text-sm font-extrabold text-white hover:bg-brand-emerald">
                <Mail className="h-4 w-4" aria-hidden="true" />
                Enviar e-mail
              </a>
            ) : null}
            {p.corporatePhone ? (
              <a href={`tel:${p.corporatePhone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-extrabold text-slate-800 hover:bg-slate-50">
                <Phone className="h-4 w-4" aria-hidden="true" />
                Ligar
              </a>
            ) : null}
            <CopyContact text={contact} />
          </div>
        </section>

        <section aria-labelledby="resp-title" className="rounded-3xl border border-line bg-white p-5 shadow-card">
          <h2 id="resp-title" className="text-lg font-extrabold text-brand-ink">
            Responsabilidades
          </h2>
          {p.responsibilities.length === 0 ? (
            <p className="mt-3 text-sm text-slate-600">Nenhuma responsabilidade cadastrada.</p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-2">
              {p.responsibilities.map((r) => (
                <li key={r.id} className="rounded-xl bg-emerald-50 px-3 py-1.5 text-sm font-bold text-brand-emerald">
                  {r.responsibility}
                  {r.isPrimary ? null : <span className="font-semibold text-slate-600"> (apoio)</span>}
                </li>
              ))}
            </ul>
          )}
          {canManage ? (
            <Link href={`/admin/colaboradores/${p.id}`} className="mt-4 inline-block text-sm font-bold text-brand-emerald hover:underline">
              Editar no FPOne Admin
            </Link>
          ) : null}
        </section>
      </div>
    </div>
  );
}
