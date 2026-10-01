"use client";

import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { archiveAction, deleteDraftAction, publishAction, savePublicationAction, scheduleAction, unscheduleAction, type AdminResult } from "@/app/(app)/admin/publicacoes/actions";
import type { PublicationInput } from "@/modules/publications/schema";
import type { RichDoc } from "@/modules/publications/content";
import { AudiencePicker } from "@/components/audience/AudiencePicker";
import { PreviewPanel } from "./PreviewPanel";
import { RichTextEditor } from "./RichTextEditor";

export type FormStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED" | "EXPIRED";

export interface PublicationFormProps {
  existing: { id: string; status: FormStatus; version: number } | null;
  initial: PublicationInput;
  categories: { id: string; type: "ANNOUNCEMENT" | "NEWS"; name: string }[];
  units: string[];
  departments: string[];
  perms: { canEdit: boolean; canPublish: boolean; canArchive: boolean };
}

const STATUS_LABEL: Record<FormStatus, string> = { DRAFT: "Rascunho", SCHEDULED: "Agendada", PUBLISHED: "Publicada", ARCHIVED: "Arquivada", EXPIRED: "Expirada" };

const field = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:border-brand-blue";
const label = "block text-sm font-bold text-brand-ink";

/** Nova publicação / edição (§62–67). Rascunho → pré-visualização → publicar ou agendar. */
export function PublicationForm({ existing, initial, categories, units, departments, perms }: PublicationFormProps) {
  const router = useRouter();
  const ids = { title: useId(), summary: useId(), category: useId(), content: useId(), publishAt: useId(), expiresAt: useId(), scheduleAt: useId() };
  const [form, setForm] = useState<PublicationInput>(initial);
  const [saved, setSaved] = useState(JSON.stringify(initial));
  const [material, setMaterial] = useState(true);
  const [previewed, setPreviewed] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [scheduleAt, setScheduleAt] = useState(initial.publishAt ?? "");
  const [result, setResult] = useState<AdminResult | null>(null);
  const [pending, start] = useTransition();

  const status = existing?.status ?? "DRAFT";
  const locked = status === "ARCHIVED" || status === "EXPIRED" || !perms.canEdit;
  const dirty = JSON.stringify(form) !== saved;
  const isNews = form.type === "NEWS";
  const typeCategories = useMemo(() => categories.filter((c) => c.type === form.type), [categories, form.type]);

  const set = <K extends keyof PublicationInput>(key: K, value: PublicationInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setPreviewed(false);
  };

  const run = (fn: () => Promise<AdminResult>, after?: (r: AdminResult) => void) =>
    start(async () => {
      const r = await fn();
      setResult(r);
      if (r.ok) after?.(r);
    });

  const save = () =>
    run(
      () => savePublicationAction(existing?.id ?? null, form, material),
      (r) => {
        setSaved(JSON.stringify(form));
        if (!existing && r.ok && r.id) router.push(`/admin/publicacoes/${r.id}`);
        else router.refresh();
      },
    );

  const openPreview = () => {
    setShowPreview(true);
    setPreviewed(true);
  };

  const canPublishNow = !!existing && perms.canPublish && (status === "DRAFT" || status === "SCHEDULED");
  const publishHint = dirty ? "Salve as alterações antes de publicar." : !previewed ? "Pré-visualize antes de publicar (§67)." : null;

  return (
    <div className="space-y-6">
      {existing ? (
        <p className="text-sm font-semibold text-slate-600">
          Status: <strong className="text-brand-ink">{STATUS_LABEL[status]}</strong> · versão {existing.version}
        </p>
      ) : null}
      {locked && existing ? (
        <p role="status" className="rounded-2xl bg-slate-100 p-4 text-sm font-semibold text-slate-700">
          {perms.canEdit ? "Publicações arquivadas ou expiradas não podem ser editadas." : "Seu perfil não pode editar esta publicação."}
        </p>
      ) : null}

      <fieldset disabled={locked || pending} className="space-y-5 rounded-3xl border border-line bg-white p-5 shadow-card sm:p-6">
        <legend className="sr-only">Dados da publicação</legend>
        <div role="radiogroup" aria-label="Tipo" className="flex flex-wrap gap-2">
          {(["ANNOUNCEMENT", "NEWS"] as const).map((t) => (
            <label key={t} className={`cursor-pointer rounded-xl border px-4 py-2 text-sm font-bold ${form.type === t ? "border-brand-ink bg-brand-ink text-white" : "border-slate-300 text-slate-700"} ${existing ? "cursor-not-allowed opacity-70" : ""}`}>
              <input
                type="radio"
                name="type"
                value={t}
                checked={form.type === t}
                disabled={!!existing}
                onChange={() => setForm((f) => ({ ...f, type: t, categoryId: null, requiresAcknowledgement: t === "NEWS" ? false : f.requiresAcknowledgement, pinned: t === "NEWS" ? false : f.pinned }))}
                className="sr-only"
              />
              {t === "ANNOUNCEMENT" ? "Comunicado" : "Novidade"}
            </label>
          ))}
        </div>

        <div>
          <label htmlFor={ids.title} className={label}>
            Título
          </label>
          <input id={ids.title} value={form.title} maxLength={200} onChange={(e) => set("title", e.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor={ids.summary} className={label}>
            Resumo
          </label>
          <textarea id={ids.summary} value={form.summary} maxLength={500} rows={2} onChange={(e) => set("summary", e.target.value)} className={field} />
        </div>
        <div>
          <label htmlFor={ids.category} className={label}>
            Categoria
          </label>
          <select id={ids.category} value={form.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value || null)} className={field}>
            <option value="">Sem categoria</option>
            {typeCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p id={ids.content} className={label}>
            Conteúdo
          </p>
          <div className="mt-1">
            <RichTextEditor initial={initial.content as RichDoc} labelledBy={ids.content} onChange={(doc) => set("content", doc)} />
          </div>
        </div>
      </fieldset>

      <AudiencePicker value={form.audiences} onChange={(v) => set("audiences", v)} units={units} departments={departments} disabled={locked || pending} />

      <fieldset disabled={locked || pending} className="space-y-4 rounded-3xl border border-line bg-white p-5 shadow-card sm:p-6">
        <legend className="px-1 text-lg font-extrabold text-brand-ink">Opções</legend>
        <div className="space-y-3 text-sm font-semibold text-slate-800">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.requiresAcknowledgement} disabled={isNews} onChange={(e) => set("requiresAcknowledgement", e.target.checked)} />
            Exigir confirmação de leitura{isNews ? " (Novidades nunca exigem)" : ""}
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.pinned} disabled={isNews} onChange={(e) => set("pinned", e.target.checked)} />
            Fixar no topo dos comunicados
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.isFeatured} onChange={(e) => set("isFeatured", e.target.checked)} />
            Destacar na Home
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={ids.expiresAt} className={label}>
              Expira em (opcional)
            </label>
            <input id={ids.expiresAt} type="datetime-local" value={form.expiresAt ?? ""} onChange={(e) => set("expiresAt", e.target.value)} className={field} />
          </div>
        </div>
        {status === "PUBLISHED" ? (
          <label className="flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-sm font-semibold text-amber-900">
            <input type="checkbox" checked={material} onChange={(e) => setMaterial(e.target.checked)} className="mt-1" />
            <span>
              Alteração material (título, conteúdo ou instrução). Gera nova versão e, se houver ciência, pede nova confirmação. Desmarque só para correções de
              ortografia ou estética.
            </span>
          </label>
        ) : null}
      </fieldset>

      {showPreview ? <PreviewPanel form={form} categories={categories} onClose={() => setShowPreview(false)} /> : null}

      <div className="sticky bottom-20 z-20 space-y-3 rounded-3xl border border-line bg-white/95 p-4 shadow-soft backdrop-blur lg:bottom-4">
        <div className="flex flex-wrap items-center gap-2">
          {!locked ? (
            <button type="button" onClick={save} disabled={pending || (!dirty && !!existing)} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-800 hover:bg-slate-50 disabled:opacity-50">
              {existing ? "Salvar alterações" : "Salvar rascunho"}
            </button>
          ) : null}
          <button type="button" onClick={openPreview} className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-800 hover:bg-slate-50">
            Pré-visualizar
          </button>
          {canPublishNow ? (
            <button
              type="button"
              onClick={() => run(() => publishAction(existing.id), () => router.refresh())}
              disabled={pending || !!publishHint}
              className="rounded-xl bg-brand-ink px-4 py-2.5 text-sm font-extrabold text-white hover:bg-brand-emerald disabled:opacity-50"
            >
              Publicar agora
            </button>
          ) : null}
          {existing && perms.canPublish && status === "SCHEDULED" ? (
            <button type="button" onClick={() => run(() => unscheduleAction(existing.id), () => router.refresh())} disabled={pending} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-extrabold text-slate-800 hover:bg-slate-50">
              Cancelar agendamento
            </button>
          ) : null}
          {existing && perms.canArchive && status !== "ARCHIVED" && status !== "DRAFT" ? (
            <button type="button" onClick={() => window.confirm("Arquivar esta publicação? Ela sai do feed, mas métricas e histórico ficam preservados.") && run(() => archiveAction(existing.id), () => router.refresh())} disabled={pending} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-extrabold text-slate-800 hover:bg-slate-50">
              Arquivar
            </button>
          ) : null}
          {existing && perms.canEdit && status === "DRAFT" ? (
            <button type="button" onClick={() => window.confirm("Excluir este rascunho? Esta ação não pode ser desfeita.") && run(() => deleteDraftAction(existing.id), () => router.push("/admin/publicacoes"))} disabled={pending} className="rounded-xl px-4 py-2.5 text-sm font-extrabold text-red-700 hover:bg-red-50">
              Excluir rascunho
            </button>
          ) : null}
        </div>

        {canPublishNow ? (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label htmlFor={ids.scheduleAt} className="block text-xs font-bold text-slate-700">
                Agendar para (horário de Brasília/Bahia)
              </label>
              <input id={ids.scheduleAt} type="datetime-local" value={scheduleAt} onChange={(e) => setScheduleAt(e.target.value)} className="mt-1 rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <button
              type="button"
              onClick={() => run(() => scheduleAction(existing.id, scheduleAt), () => router.refresh())}
              disabled={pending || !!publishHint || scheduleAt === ""}
              className="rounded-xl border border-brand-ink px-4 py-2 text-sm font-extrabold text-brand-ink hover:bg-slate-50 disabled:opacity-50"
            >
              {status === "SCHEDULED" ? "Reagendar" : "Agendar"}
            </button>
          </div>
        ) : null}

        {canPublishNow && publishHint ? <p className="text-xs font-semibold text-slate-600">{publishHint}</p> : null}
        {result ? (
          <p role={result.ok ? "status" : "alert"} className={`text-sm font-bold ${result.ok ? "text-brand-emerald" : "text-red-700"}`}>
            {result.message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
