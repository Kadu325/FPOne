import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { DOCUMENT_CATEGORIES } from "@/modules/documents/file";
import { fileKind, formatBytes } from "@/modules/documents/format";
import { relativeDay } from "@/modules/home/time";
import { requireUser } from "@/server/auth/session";
import { loadAudienceSubject } from "@/server/authz/audience";
import { db } from "@/server/db";
import { listDocuments } from "@/server/documents/documents";

export const metadata: Metadata = { title: "Documentos" };
export const dynamic = "force-dynamic";

/** Biblioteca de documentos do colaborador (§14, §161). Só publicados e do seu público. */
export default async function DocumentsPage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const user = await requireUser();
  const now = new Date();
  const { categoria = "" } = await searchParams;
  const category = (DOCUMENT_CATEGORIES as readonly string[]).includes(categoria) ? categoria : undefined;
  const subject = await loadAudienceSubject(db(), user.id);
  const docs = subject ? await listDocuments(db(), subject, { category }) : [];
  const pill = (selected: boolean) =>
    `rounded-xl px-3.5 py-2 text-xs font-extrabold ${selected ? "bg-brand-ink text-white" : "border border-slate-200 bg-white text-slate-700 hover:border-brand-teal/40"}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs font-extrabold uppercase tracking-[.16em] text-brand-blue">Conhecimento</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-ink">Documentos</h1>
        <p className="mt-2 text-sm font-medium text-slate-600">Políticas, procedimentos, POPs, normas, manuais e formulários vigentes.</p>
      </header>
      <nav aria-label="Filtrar por categoria" className="flex flex-wrap gap-2">
        <Link href="/documentos" aria-current={!category ? "page" : undefined} className={pill(!category)}>
          Todos
        </Link>
        {DOCUMENT_CATEGORIES.map((c) => (
          <Link key={c} href={`/documentos?categoria=${encodeURIComponent(c)}`} aria-current={category === c ? "page" : undefined} className={pill(category === c)}>
            {c}
          </Link>
        ))}
      </nav>
      {docs.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-slate-600 shadow-card">Nenhum documento disponível para você{category ? " nesta categoria" : ""}.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-3xl border border-line bg-white shadow-card">
          {docs.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-3 p-4">
              <span aria-hidden="true" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-50 text-brand-blue">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-brand-ink">{d.title}</p>
                <p className="text-xs font-semibold text-slate-600">
                  {d.category} · Versão {d.version} · {relativeDay(d.updatedAt, now).toLowerCase()}
                  {d.sizeBytes !== null ? ` · ${fileKind(d.mimeType)}, ${formatBytes(d.sizeBytes)}` : ""}
                </p>
                {d.description ? <p className="mt-1 text-sm text-slate-700">{d.description}</p> : null}
              </div>
              <a href={`/api/documentos/${d.id}/download`} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50">
                <Download className="h-4 w-4" aria-hidden="true" />
                Baixar<span className="sr-only"> {d.title}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
