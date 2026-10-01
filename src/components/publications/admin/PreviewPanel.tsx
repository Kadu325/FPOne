"use client";

import { Monitor, Smartphone, Tablet, X, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { parseStoredDoc } from "@/modules/publications/content";
import type { PublicationInput } from "@/modules/publications/schema";
import { RichContent } from "../RichContent";

const DEVICES: { id: string; label: string; icon: LucideIcon; width: string }[] = [
  { id: "desktop", label: "Desktop", icon: Monitor, width: "max-w-3xl" },
  { id: "tablet", label: "Tablet", icon: Tablet, width: "max-w-[768px]" },
  { id: "mobile", label: "Mobile", icon: Smartphone, width: "max-w-[375px]" },
];

/** Pré-visualização obrigatória (§67): mesmo componente da leitura, em três larguras. */
export function PreviewPanel({ form, categories, onClose }: { form: PublicationInput; categories: { id: string; name: string }[]; onClose: () => void }) {
  const [device, setDevice] = useState("desktop");
  const width = DEVICES.find((d) => d.id === device)?.width ?? "max-w-3xl";
  const category = categories.find((c) => c.id === form.categoryId)?.name;

  return (
    <section aria-labelledby="preview-title" className="rounded-3xl border border-line bg-bg p-4 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="preview-title" className="text-lg font-extrabold text-brand-ink">
          Pré-visualização
        </h2>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Dispositivo" className="flex gap-1 rounded-xl bg-white p-1">
            {DEVICES.map((d) => (
              <button
                key={d.id}
                type="button"
                aria-pressed={device === d.id}
                onClick={() => setDevice(d.id)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${device === d.id ? "bg-brand-ink text-white" : "text-slate-700 hover:bg-slate-100"}`}
              >
                <d.icon className="h-4 w-4" aria-hidden="true" />
                {d.label}
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar pré-visualização" className="grid h-9 w-9 place-items-center rounded-xl bg-white text-slate-700 hover:bg-slate-100">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <article className={`mx-auto space-y-4 rounded-2xl bg-bg p-4 ring-1 ring-slate-200 ${width}`}>
          <div className="flex flex-wrap items-center gap-2">
            {form.requiresAcknowledgement ? (
              <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[.12em] text-brand-emerald">Leitura obrigatória</span>
            ) : null}
            {category ? <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-extrabold uppercase tracking-[.1em] text-slate-700">{category}</span> : null}
          </div>
          <p className="text-3xl font-extrabold leading-tight tracking-tight text-brand-ink">{form.title || "Sem título"}</p>
          {form.summary ? <p className="text-lg font-medium leading-7 text-slate-600">{form.summary}</p> : null}
          <div className="rounded-3xl border border-line bg-white p-5 shadow-card">
            <RichContent doc={parseStoredDoc(form.content)} />
          </div>
        </article>
      </div>
    </section>
  );
}
