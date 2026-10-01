"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelEventAction, deleteEventAction, publishEventAction, saveEventAction, type EventResult } from "@/app/(app)/admin/agenda/actions";
import { AudiencePicker, type AudienceValue } from "@/components/audience/AudiencePicker";

export interface EventRow {
  id: string;
  title: string;
  description: string;
  location: string;
  startLocal: string;
  endLocal: string;
  when: string;
  status: "DRAFT" | "SCHEDULED" | "PUBLISHED" | "CANCELLED" | "FINISHED";
  audiences: AudienceValue;
}

interface Draft {
  title: string;
  description: string;
  location: string;
  startAt: string;
  endAt: string;
  audiences: AudienceValue;
}

const STATUS: Record<EventRow["status"], string> = { DRAFT: "Rascunho", SCHEDULED: "Agendado", PUBLISHED: "Publicado", CANCELLED: "Cancelado", FINISHED: "Encerrado" };
const EMPTY: Draft = { title: "", description: "", location: "", startAt: "", endAt: "", audiences: [{ audienceType: "ALL", audienceId: null }] };
const field = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";

/** FPOne Admin › Agenda: rascunho → publicar; cancelar mantém no histórico (RN-EVT-004). */
export function EventAdmin({ events, units, departments }: { events: EventRow[]; units: string[]; departments: string[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [result, setResult] = useState<EventResult | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<EventResult>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) {
        after?.();
        router.refresh();
      }
    });

  const edit = (e: EventRow | null) => {
    setEditing(e ? e.id : "new");
    setDraft(e ? { title: e.title, description: e.description, location: e.location, startAt: e.startLocal, endAt: e.endLocal, audiences: e.audiences } : EMPTY);
    setResult(null);
  };

  return (
    <div className="space-y-6">
      <button type="button" onClick={() => edit(null)} className="inline-flex items-center gap-2 rounded-xl bg-brand-ink px-4 py-2.5 text-sm font-extrabold text-white hover:bg-brand-emerald">
        <Plus className="h-4 w-4" aria-hidden="true" />
        Novo evento
      </button>

      {editing ? (
        <form
          aria-label={editing === "new" ? "Novo evento" : "Editar evento"}
          onSubmit={(e) => {
            e.preventDefault();
            run(() => saveEventAction(editing === "new" ? null : editing, draft), () => setEditing(null));
          }}
          className="space-y-4"
        >
          <fieldset disabled={pending} className="grid gap-4 rounded-3xl border border-line bg-white p-5 shadow-card sm:grid-cols-2">
            <legend className="sr-only">Dados do evento</legend>
            <div className="sm:col-span-2">
              <label htmlFor="evt-title" className="text-sm font-bold text-brand-ink">
                Título
              </label>
              <input id="evt-title" required minLength={3} maxLength={160} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className={field} />
            </div>
            <div>
              <label htmlFor="evt-start" className="text-sm font-bold text-brand-ink">
                Início
              </label>
              <input id="evt-start" type="datetime-local" required value={draft.startAt} onChange={(e) => setDraft({ ...draft, startAt: e.target.value })} className={field} />
            </div>
            <div>
              <label htmlFor="evt-end" className="text-sm font-bold text-brand-ink">
                Término
              </label>
              <input id="evt-end" type="datetime-local" required value={draft.endAt} onChange={(e) => setDraft({ ...draft, endAt: e.target.value })} className={field} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="evt-loc" className="text-sm font-bold text-brand-ink">
                Local
              </label>
              <input id="evt-loc" maxLength={160} value={draft.location} onChange={(e) => setDraft({ ...draft, location: e.target.value })} className={field} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="evt-desc" className="text-sm font-bold text-brand-ink">
                Descrição
              </label>
              <textarea id="evt-desc" rows={3} maxLength={2000} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} className={field} />
            </div>
            <p className="text-xs text-slate-600 sm:col-span-2">Horário de Brasília/Bahia.</p>
          </fieldset>
          <AudiencePicker value={draft.audiences} onChange={(audiences) => setDraft({ ...draft, audiences })} units={units} departments={departments} disabled={pending} />
          <div className="flex gap-2">
            <button disabled={pending} className="rounded-xl bg-brand-ink px-4 py-2.5 text-sm font-extrabold text-white hover:bg-brand-emerald disabled:opacity-60">
              Salvar evento
            </button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-extrabold text-slate-800 hover:bg-slate-50">
              Cancelar edição
            </button>
          </div>
        </form>
      ) : null}

      {result ? (
        <p role={result.ok ? "status" : "alert"} className={`text-sm font-bold ${result.ok ? "text-brand-emerald" : "text-red-700"}`}>
          {result.message}
        </p>
      ) : null}

      {events.length === 0 ? (
        <p className="rounded-2xl border border-line bg-white p-6 text-sm text-slate-600 shadow-card">Nenhum evento cadastrado ainda.</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-3xl border border-line bg-white shadow-card">
          {events.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-brand-ink">
                  {e.title} <span className="ml-1 rounded-md bg-slate-100 px-1.5 py-0.5 text-[11px] font-bold text-slate-700">{STATUS[e.status]}</span>
                </p>
                <p className="text-xs font-semibold text-slate-600">
                  {e.when}
                  {e.location ? ` · ${e.location}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {e.status === "DRAFT" || e.status === "PUBLISHED" ? (
                  <button type="button" onClick={() => edit(e)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-800 hover:bg-slate-50">
                    Editar<span className="sr-only"> {e.title}</span>
                  </button>
                ) : null}
                {e.status === "DRAFT" ? (
                  <>
                    <button type="button" disabled={pending} onClick={() => run(() => publishEventAction(e.id))} className="rounded-lg bg-brand-ink px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-emerald">
                      Publicar<span className="sr-only"> {e.title}</span>
                    </button>
                    <button type="button" disabled={pending} onClick={() => window.confirm(`Excluir o rascunho "${e.title}"?`) && run(() => deleteEventAction(e.id))} className="rounded-lg px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50">
                      Excluir<span className="sr-only"> {e.title}</span>
                    </button>
                  </>
                ) : null}
                {e.status === "PUBLISHED" ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                      const reason = window.prompt("Motivo do cancelamento (opcional):", "");
                      if (reason !== null) run(() => cancelEventAction(e.id, reason));
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
                  >
                    Cancelar evento<span className="sr-only"> {e.title}</span>
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
