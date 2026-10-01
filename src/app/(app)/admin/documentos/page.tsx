import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Unauthorized } from "@/components/feedback/StateMessage";
import { ADMIN_NAME } from "@/lib/constants";
import { formatDateTime } from "@/modules/documents/format";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/can";
import { db } from "@/server/db";
import { listDocumentsForAdmin } from "@/server/documents/admin";

export const metadata: Metadata = { title: "Documentos" };
export const dynamic = "force-dynamic";

const STATUS = { DRAFT: "Rascunho", PUBLISHED: "Publicado", SUPERSEDED: "Substituído", ARCHIVED: "Arquivado" } as const;

export default async function DocumentsAdminPage() {
  const user = await requireUser();
  if (!can(user, "document.manage")) {
    return (
      <div className="px-4 py-16">
        <Unauthorized />
      </div>
    );
  }
  const docs = await listDocumentsForAdmin(db(), user);
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm font-bold text-brand-emerald hover:underline">
            {ADMIN_NAME}
          </Link>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-ink">Documentos</h1>
        </div>
        <Link href="/admin/documentos/novo" className="inline-flex items-center gap-2 rounded-xl bg-brand-ink px-4 py-2.5 text-sm font-extrabold text-white hover:bg-brand-emerald">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Novo documento
        </Link>
      </header>
      {docs.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-slate-600 shadow-card">Nenhum documento cadastrado ainda.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-3xl border border-line bg-white shadow-card">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 p-4">
              <div>
                <Link href={`/admin/documentos/${d.id}`} className="font-extrabold text-brand-ink hover:text-brand-emerald hover:underline">
                  {d.title}
                </Link>
                <p className="text-xs font-semibold text-slate-600">
                  {d.category} · {STATUS[d.status]} · versão {d.currentVersion || "—"} · {formatDateTime(d.updatedAt)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
