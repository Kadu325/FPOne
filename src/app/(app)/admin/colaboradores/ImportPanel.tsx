"use client";

import { useActionState } from "react";
import { importEmployeesAction, type ImportState } from "./actions";

function downloadCsv(content: string) {
  const blob = new Blob(["﻿", content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "erros-carga-colaboradores.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportPanel() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importEmployeesAction, { status: "idle" });

  return (
    <section aria-labelledby="import" className="rounded-2xl border border-line bg-white p-6 shadow-card">
      <h2 id="import" className="text-xl font-bold text-brand-ink">
        Carga de colaboradores (CSV)
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Colunas: <code className="text-slate-800">matricula, nome, unidade, departamento, cargo, cpf, email_corporativo (opcional), status</code>.
        Separador <code>;</code> ou <code>,</code>, em UTF-8. A carga é tudo ou nada: com qualquer erro, nada é gravado. O CPF é
        transformado em código irreversível e não fica guardado.
      </p>
      <form action={action} className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="csv" className="text-xs font-extrabold text-slate-700">
            Arquivo CSV (até 5 MB)
          </label>
          <input id="csv" name="file" type="file" accept=".csv,text/csv" required className="mt-1.5 block text-sm text-slate-700" />
        </div>
        <button className="rounded-xl bg-brand-ink px-4 py-2.5 text-sm font-bold text-white hover:bg-brand-emerald disabled:opacity-70" disabled={pending}>
          {pending ? "Importando…" : "Importar"}
        </button>
      </form>

      <div aria-live="polite" className="mt-4 space-y-3">
        {state.status === "error" ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-800">
            {state.message}
          </p>
        ) : null}

        {state.status === "invalid" ? (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-bold">Nada foi gravado: {state.errors.length} problema(s) no arquivo.</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {state.errors.slice(0, 10).map((e, i) => (
                <li key={i}>
                  Linha {e.line}
                  {e.matricula ? ` (matrícula ${e.matricula})` : ""}: {e.field}: {e.message}
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => downloadCsv(state.errorsCsv)} className="mt-3 font-bold text-red-900 underline underline-offset-4">
              Baixar relatório completo de erros
            </button>
          </div>
        ) : null}

        {state.status === "ok" ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
            <p className="font-bold">Carga concluída: {state.summary.total} linha(s).</p>
            <p className="mt-1">
              {state.summary.created} novo(s), {state.summary.updated} atualizado(s), {state.summary.deactivated} inativado(s),{" "}
              {state.summary.reactivated} reativado(s).
            </p>
            {state.summary.absent.length > 0 ? (
              <details className="mt-3">
                <summary className="cursor-pointer font-bold">
                  {state.summary.absent.length} colaborador(es) ativo(s) não vieram no arquivo: revise e inative manualmente se for o caso
                </summary>
                <ul className="mt-2 max-h-64 list-disc space-y-1 overflow-y-auto pl-5">
                  {state.summary.absent.map((a) => (
                    <li key={a.matricula}>
                      {a.matricula}: {a.name}
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
