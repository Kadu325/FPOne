"use client";

import { CheckCircle2 } from "lucide-react";
import { useActionState } from "react";
import { acknowledgeAction, type AckState } from "@/app/(app)/comunicados/actions";

/** "Li e estou ciente" (§10). O registro e o horário são do servidor; repetir não duplica. */
export function AcknowledgeButton({ id, acknowledged }: { id: string; acknowledged: boolean }) {
  const [state, action, pending] = useActionState<AckState, FormData>(acknowledgeAction, { status: acknowledged ? "done" : "idle" });

  if (state.status === "done") {
    return (
      <p role="status" className="flex items-center gap-2 rounded-2xl bg-emerald-50 p-4 text-sm font-bold text-brand-emerald">
        <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        Ciência registrada. Obrigado por confirmar a leitura.
      </p>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-3xl border border-line bg-white p-5 shadow-card">
      <input type="hidden" name="id" value={id} />
      <p className="text-sm font-semibold text-slate-700">Este comunicado pede sua confirmação de leitura.</p>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-ink px-4 py-2.5 text-sm font-extrabold text-white hover:bg-brand-emerald disabled:opacity-70"
      >
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        {pending ? "Registrando…" : "Li e estou ciente"}
      </button>
      {state.status === "error" ? (
        <p role="alert" className="text-sm font-semibold text-red-700">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
