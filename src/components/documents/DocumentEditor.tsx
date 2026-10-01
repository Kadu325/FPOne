"use client";

import { useRouter } from "next/navigation";
import { useActionState, useState, useTransition } from "react";
import { archiveDocumentAction, deleteDocumentAction, publishDocumentAction, saveDocumentAction, uploadVersionAction, type DocResult } from "@/app/(app)/admin/documentos/actions";
import { AudiencePicker, type AudienceValue } from "@/components/audience/AudiencePicker";
import { ACCEPTED_EXTENSIONS, DOCUMENT_CATEGORIES } from "@/modules/documents/file";

type Status = "DRAFT" | "PUBLISHED" | "SUPERSEDED" | "ARCHIVED";
const STATUS: Record<Status, string> = { DRAFT: "Rascunho", PUBLISHED: "Publicado", SUPERSEDED: "Substituída", ARCHIVED: "Arquivado" };

export interface DocumentEditorProps {
  existing: { id: string; status: Status; currentVersion: number; owner: string } | null;
  initial: { title: string; description: string; category: string; effectiveAt: string; reviewAt: string; audiences: AudienceValue };
  versions: { version: number; fileName: string; size: string; status: Status; when: string; uploadedBy: string }[];
  units: string[];
  departments: string[];
}

const field = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";

function Feedback({ result }: { result: DocResult | null }) {
  if (!result) return null;
  return (
    <p role={result.ok ? "status" : "alert"} className={`text-sm font-bold ${result.ok ? "text-brand-emerald" : "text-red-700"}`}>
      {result.message}
    </p>
  );
}

/** Documento (§161): dados + público; versões com histórico; publicar, arquivar ou excluir rascunho. */
export function DocumentEditor({ existing, initial, versions, units, departments }: DocumentEditorProps) {
  const router = useRouter();
  const [meta, setMeta] = useState(initial);
  const [result, setResult] = useState<DocResult | null>(null);
  const [pending, start] = useTransition();
  const [uploadResult, uploadAction, uploading] = useActionState<DocResult | null, FormData>(async (prev, form) => {
    const r = await uploadVersionAction(prev, form);
    if (r.ok) router.refresh();
    return r;
  }, null);
  const archived = existing?.status === "ARCHIVED";

  const run = (fn: () => Promise<DocResult>, after?: (r: DocResult) => void) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) {
        after?.(r);
        router.refresh();
      }
    });

  return (
    <div className="space-y-6">
      {existing ? (
        <p className="text-sm font-semibold text-slate-600">
          Status: <strong className="text-brand-ink">{STATUS[existing.status]}</strong> · versão vigente {existing.currentVersion || "—"} · responsável: {existing.owner}
        </p>
      ) : null}

      <form
        aria-label="Dados do documento"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () => saveDocumentAction(existing?.id ?? null, meta),
            (r) => {
              if (!existing && r.ok && r.id) router.push(`/admin/documentos/${r.id}`);
            },
          );
        }}
        className="space-y-4"
      >
        <fieldset disabled={pending || archived} className="grid gap-4 rounded-3xl border border-line bg-white p-5 shadow-card sm:grid-cols-2">
          <legend className="sr-only">Dados do documento</legend>
          <div className="sm:col-span-2">
            <label htmlFor="doc-title" className="text-sm font-bold text-brand-ink">
              Título
            </label>
            <input id="doc-title" required minLength={3} maxLength={160} value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} className={field} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="doc-desc" className="text-sm font-bold text-brand-ink">
              Descrição
            </label>
            <textarea id="doc-desc" rows={2} maxLength={1000} value={meta.description} onChange={(e) => setMeta({ ...meta, description: e.target.value })} className={field} />
          </div>
          <div>
            <label htmlFor="doc-cat" className="text-sm font-bold text-brand-ink">
              Categoria
            </label>
            <select id="doc-cat" required value={meta.category} onChange={(e) => setMeta({ ...meta, category: e.target.value })} className={field}>
              <option value="">Selecione…</option>
              {DOCUMENT_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="doc-eff" className="text-sm font-bold text-brand-ink">
                Vigência
              </label>
              <input id="doc-eff" type="date" value={meta.effectiveAt} onChange={(e) => setMeta({ ...meta, effectiveAt: e.target.value })} className={field} />
            </div>
            <div>
              <label htmlFor="doc-rev" className="text-sm font-bold text-brand-ink">
                Revisão
              </label>
              <input id="doc-rev" type="date" value={meta.reviewAt} onChange={(e) => setMeta({ ...meta, reviewAt: e.target.value })} className={field} />
            </div>
          </div>
        </fieldset>
        <AudiencePicker value={meta.audiences} onChange={(audiences) => setMeta({ ...meta, audiences })} units={units} departments={departments} disabled={pending || archived} />
        {!archived ? (
          <button disabled={pending} className="rounded-xl bg-brand-ink px-4 py-2.5 text-sm font-extrabold text-white hover:bg-brand-emerald disabled:opacity-60">
            {existing ? "Salvar dados" : "Criar documento"}
          </button>
        ) : null}
      </form>

      {existing && !archived ? (
        <section aria-labelledby="upload-title" className="rounded-3xl border border-line bg-white p-5 shadow-card">
          <h2 id="upload-title" className="text-lg font-extrabold text-brand-ink">
            {existing.currentVersion === 0 ? "Arquivo" : "Nova versão"}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            PDF, DOCX, XLSX, PPTX, PNG ou JPG, até 20 MB.
            {existing.status === "PUBLISHED" ? " A nova versão entra em vigor na hora; a anterior fica no histórico como substituída." : null}
          </p>
          <form action={uploadAction} className="mt-3 flex flex-wrap items-end gap-3">
            <input type="hidden" name="documentId" value={existing.id} />
            <div>
              <label htmlFor="doc-file" className="text-sm font-bold text-brand-ink">
                Selecionar arquivo
              </label>
              <input id="doc-file" name="file" type="file" required accept={ACCEPTED_EXTENSIONS} className="mt-1 block text-sm" />
            </div>
            <button disabled={uploading} className="rounded-xl bg-brand-ink px-4 py-2.5 text-sm font-extrabold text-white hover:bg-brand-emerald disabled:opacity-60">
              {uploading ? "Enviando…" : "Enviar arquivo"}
            </button>
          </form>
          <div className="mt-3">
            <Feedback result={uploadResult} />
          </div>
        </section>
      ) : null}

      {existing && versions.length > 0 ? (
        <section aria-labelledby="versoes-title" className="rounded-3xl border border-line bg-white p-5 shadow-card">
          <h2 id="versoes-title" className="text-lg font-extrabold text-brand-ink">
            Versões
          </h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {versions.map((v) => (
              <li key={v.version} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="text-slate-800">
                  <strong>v{v.version}</strong> · {v.fileName} · {v.size} · {STATUS[v.status]} · {v.when} · {v.uploadedBy}
                </span>
                <a href={`/api/admin/documentos/${existing.id}/versoes/${v.version}`} className="font-bold text-brand-blue hover:underline">
                  Baixar<span className="sr-only"> versão {v.version}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {existing ? (
        <div className="flex flex-wrap gap-2">
          {existing.status === "DRAFT" ? (
            <>
              <button type="button" disabled={pending} onClick={() => run(() => publishDocumentAction(existing.id))} className="rounded-xl bg-brand-ink px-4 py-2.5 text-sm font-extrabold text-white hover:bg-brand-emerald">
                Publicar documento
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => window.confirm("Excluir este rascunho e seus arquivos?") && run(() => deleteDocumentAction(existing.id), () => router.push("/admin/documentos"))}
                className="rounded-xl px-4 py-2.5 text-sm font-extrabold text-red-700 hover:bg-red-50"
              >
                Excluir rascunho
              </button>
            </>
          ) : null}
          {existing.status === "PUBLISHED" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => window.confirm("Arquivar este documento? Ele sai da biblioteca, mas as versões ficam guardadas.") && run(() => archiveDocumentAction(existing.id))}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-extrabold text-slate-800 hover:bg-slate-50"
            >
              Arquivar
            </button>
          ) : null}
        </div>
      ) : null}
      <Feedback result={result} />
    </div>
  );
}
