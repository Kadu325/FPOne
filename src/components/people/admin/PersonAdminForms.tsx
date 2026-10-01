"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { setResponsibilitiesAction, updatePhoneAction, type ActionResult } from "@/app/(app)/admin/colaboradores/actions";

const field = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";

function Feedback({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return (
    <p role={result.ok ? "status" : "alert"} className={`text-sm font-bold ${result.ok ? "text-brand-emerald" : "text-red-700"}`}>
      {result.message}
    </p>
  );
}

/** Telefone corporativo (RN-PROF-003). Cargo, departamento e unidade vêm só do CSV (RN-PROF-002). */
export function PhoneForm({ employeeId, initial }: { employeeId: string; initial: string }) {
  const [phone, setPhone] = useState(initial);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setResult(await updatePhoneAction(employeeId, phone)));
      }}
      className="space-y-3"
    >
      <div>
        <label htmlFor="phone" className="text-sm font-bold text-brand-ink">
          Telefone corporativo
        </label>
        <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} inputMode="tel" placeholder="(77) 3333-0000" className={field} />
      </div>
      <button disabled={pending} className="rounded-xl bg-brand-ink px-4 py-2 text-sm font-bold text-white hover:bg-brand-emerald disabled:opacity-60">
        Salvar telefone
      </button>
      <Feedback result={result} />
    </form>
  );
}

interface Row {
  key: number;
  responsibility: string;
  keywords: string;
  isPrimary: boolean;
}

/** Responsabilidades cadastradas por perfil autorizado (§97, RN-PROF-006, RN-DIR-003). */
export function ResponsibilitiesForm({ employeeId, initial }: { employeeId: string; initial: { responsibility: string; keywords: string[]; isPrimary: boolean }[] }) {
  const [rows, setRows] = useState<Row[]>(initial.map((r, i) => ({ key: i, responsibility: r.responsibility, keywords: r.keywords.join(", "), isPrimary: r.isPrimary })));
  const [next, setNext] = useState(initial.length);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();

  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const save = () =>
    start(async () => {
      const list = rows
        .filter((r) => r.responsibility.trim() !== "")
        .map((r) => ({
          responsibility: r.responsibility,
          keywords: r.keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
          isPrimary: r.isPrimary,
        }));
      setResult(await setResponsibilitiesAction(employeeId, list));
    });

  return (
    <div className="space-y-4">
      {rows.length === 0 ? <p className="text-sm text-slate-600">Nenhuma responsabilidade cadastrada.</p> : null}
      <ul className="space-y-3">
        {rows.map((r, i) => (
          <li key={r.key}>
            <fieldset className="grid gap-3 rounded-2xl border border-slate-200 p-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
              <legend className="sr-only">Responsabilidade {i + 1}</legend>
              <div>
                <label htmlFor={`resp-${r.key}`} className="text-xs font-bold text-slate-700">
                  Responsabilidade
                </label>
                <input id={`resp-${r.key}`} value={r.responsibility} maxLength={120} onChange={(e) => update(r.key, { responsibility: e.target.value })} className={field} />
              </div>
              <div>
                <label htmlFor={`kw-${r.key}`} className="text-xs font-bold text-slate-700">
                  Palavras-chave (separadas por vírgula)
                </label>
                <input id={`kw-${r.key}`} value={r.keywords} onChange={(e) => update(r.key, { keywords: e.target.value })} className={field} />
              </div>
              <label className="flex items-center gap-2 pb-2 text-sm font-semibold text-slate-800">
                <input type="checkbox" checked={r.isPrimary} onChange={(e) => update(r.key, { isPrimary: e.target.checked })} />
                Principal
              </label>
              <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={`Remover responsabilidade ${i + 1}`} className="grid h-10 w-10 place-items-center rounded-xl text-red-700 hover:bg-red-50">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </fieldset>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setRows((rs) => [...rs, { key: next, responsibility: "", keywords: "", isPrimary: true }]);
            setNext((n) => n + 1);
          }}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Adicionar
        </button>
        <button type="button" onClick={save} disabled={pending} className="rounded-xl bg-brand-ink px-4 py-2 text-sm font-bold text-white hover:bg-brand-emerald disabled:opacity-60">
          Salvar responsabilidades
        </button>
      </div>
      <Feedback result={result} />
    </div>
  );
}
