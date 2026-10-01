"use client";

import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteLinkAction, moveLinkAction, saveLinkAction, type LinkResult } from "@/app/(app)/admin/links/actions";
import { AudiencePicker, type AudienceValue } from "@/components/audience/AudiencePicker";

export interface LinkRow {
  id: string;
  label: string;
  description: string;
  url: string;
  active: boolean;
  owner: string;
  audiences: AudienceValue;
}

interface Draft {
  label: string;
  description: string;
  url: string;
  active: boolean;
  audiences: AudienceValue;
}

const EMPTY: Draft = { label: "", description: "", url: "https://", active: true, audiences: [{ audienceType: "ALL", audienceId: null }] };
const field = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";

/** FPOne Admin › Links úteis: lista ordenável, criar/editar com público, ativar/desativar, excluir. */
export function LinkAdmin({ links, units, departments }: { links: LinkRow[]; units: string[]; departments: string[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [result, setResult] = useState<LinkResult | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<LinkResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });

  const edit = (l: LinkRow | null) => {
    setEditing(l ? l.id : "new");
    setDraft(l ? { label: l.label, description: l.description, url: l.url, active: l.active, audiences: l.audiences } : EMPTY);
    setResult(null);
  };

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => edit(null)} className="inline-flex items-center gap-2 rounded-xl bg-brand-ink px-4 py-2.5 text-sm font-extrabold text-white hover:bg-brand-emerald">
        <Plus className="h-4 w-4" aria-hidden="true" />
        Novo link
      </button>

      {editing ? (
        <form
          aria-label={editing === "new" ? "Novo link" : "Editar link"}
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveLinkAction(editing === "new" ? null : editing, draft), () => setEditing(null));
          }}
          className="space-y-4"
        >
          <fieldset disabled={pending} className="grid gap-4 rounded-3xl border border-line bg-white p-5 shadow-card sm:grid-cols-2">
            <legend className="sr-only">Dados do link</legend>
            <div>
              <label htmlFor="link-label" className="text-sm font-bold text-brand-ink">
                Nome
              </label>
              <input id="link-label" required minLength={2} maxLength={60} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} className={field} />
            </div>
            <div>
              <label htmlFor="link-desc" className="text-sm font-bold text-brand-ink">
                Descrição curta
              </label>
              <input id="link-desc" maxLength={120} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={field} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="link-url" className="text-sm font-bold text-brand-ink">
                Endereço (https://… ou rota interna /…)
              </label>
              <input id="link-url" required maxLength={2000} value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} className={field} />
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} />
              Ativo
            </label>
          </fieldset>
          <AudiencePicker value={draft.audiences} onChange={(audiences) => setDraft({ ...draft, audiences })} units={units} departments={departments} disabled={pending} />
          <div className="flex gap-2">
            <button disabled={pending} className="rounded-xl bg-brand-ink px-4 py-2.5 text-sm font-extrabold text-white hover:bg-brand-emerald disabled:opacity-60">
              Salvar link
            </button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-extrabold text-slate-800 hover:bg-slate-50">
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {result ? (
        <p role={result.ok ? "status" : "alert"} className={`text-sm font-bold ${result.ok ? "text-brand-emerald" : "text-red-700"}`}>
          {result.message}
        </p>
      ) : null}

      {links.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-slate-600 shadow-card">Nenhum link cadastrado ainda.</p>
      ) : (
        <ol className="divide-y divide-slate-100 rounded-3xl border border-line bg-white shadow-card">
          {links.map((l, i) => (
            <li key={l.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-brand-ink">
                  {l.label} {!l.active ? <span className="ml-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">Inativo</span> : null}
                </p>
                <p className="truncate text-xs font-semibold text-slate-600">
                  {l.url} · responsável: {l.owner}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" disabled={pending || i === 0} onClick={() => run(() => moveLinkAction(l.id, "up"))} aria-label={`Subir ${l.label}`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40">
                  <ArrowUp className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" disabled={pending || i === links.length - 1} onClick={() => run(() => moveLinkAction(l.id, "down"))} aria-label={`Descer ${l.label}`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-700 hover:bg-slate-100 disabled:opacity-40">
                  <ArrowDown className="h-4 w-4" aria-hidden="true" />
                </button>
                <button type="button" onClick={() => edit(l)} aria-label={`Editar ${l.label}`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-700 hover:bg-slate-100">
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => window.confirm(`Excluir o link "${l.label}"?`) && run(() => deleteLinkAction(l.id))}
                  aria-label={`Excluir ${l.label}`}
                  className="grid h-9 w-9 place-items-center rounded-lg text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
