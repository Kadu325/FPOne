import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Unauthorized } from "@/components/feedback/StateMessage";
import { PhoneForm, ResponsibilitiesForm } from "@/components/people/admin/PersonAdminForms";
import { ADMIN_NAME } from "@/lib/constants";
import { BusinessError } from "@/lib/errors";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/can";
import { db } from "@/server/db";
import { getProfile, type PersonCard } from "@/server/people/directory";

export const metadata: Metadata = { title: "Editar colaborador" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** FPOne Admin › Colaboradores › perfil (§104). */
export default async function EmployeeAdminPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const canPhone = can(user, "employee.update");
  const canResp = can(user, "responsibility.manage");
  if (!can(user, "admin.access") || (!canPhone && !canResp)) {
    return (
      <div className="px-4 py-16">
        <Unauthorized />
      </div>
    );
  }
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  let p: PersonCard;
  try {
    p = await getProfile(db(), user, id);
  } catch (e) {
    if (e instanceof BusinessError && e.code === "ERR_NOT_FOUND") notFound();
    throw e;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <Link href="/admin/colaboradores" className="text-sm font-bold text-brand-emerald hover:underline">
          {ADMIN_NAME} › Colaboradores
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-ink">{p.name}</h1>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          {p.jobTitle} · {p.department} · {p.unit}
        </p>
        <p className="mt-1 text-xs text-slate-600">Cargo, departamento e unidade vêm da carga CSV do RH.</p>
      </header>
      {canPhone ? (
        <section aria-labelledby="contato-admin" className="rounded-3xl border border-line bg-white p-5 shadow-card">
          <h2 id="contato-admin" className="mb-3 text-lg font-extrabold text-brand-ink">
            Contato corporativo
          </h2>
          <PhoneForm employeeId={p.id} initial={p.corporatePhone ?? ""} />
        </section>
      ) : null}
      {canResp ? (
        <section aria-labelledby="resp-admin" className="rounded-3xl border border-line bg-white p-5 shadow-card">
          <h2 id="resp-admin" className="mb-3 text-lg font-extrabold text-brand-ink">
            Responsabilidades
          </h2>
          <ResponsibilitiesForm employeeId={p.id} initial={p.responsibilities} />
        </section>
      ) : null}
      <Link href={`/pessoas/${p.id}`} className="inline-block text-sm font-bold text-brand-emerald hover:underline">
        Ver perfil público
      </Link>
    </div>
  );
}
