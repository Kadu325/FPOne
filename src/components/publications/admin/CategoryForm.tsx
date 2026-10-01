"use client";

import { useActionState } from "react";
import { createCategoryAction, type CategoryState } from "@/app/(app)/admin/publicacoes/actions";

export function CategoryForm() {
  const [state, action, pending] = useActionState<CategoryState, FormData>(createCategoryAction, { status: "idle" });
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 rounded-3xl border border-line bg-white p-5 shadow-card">
      <div>
        <label htmlFor="cat-type" className="block text-sm font-bold text-brand-ink">
          Tipo
        </label>
        <select id="cat-type" name="type" className="mt-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="ANNOUNCEMENT">Comunicados</option>
          <option value="NEWS">Novidades</option>
        </select>
      </div>
      <div>
        <label htmlFor="cat-name" className="block text-sm font-bold text-brand-ink">
          Nome da categoria
        </label>
        <input id="cat-name" name="name" required minLength={2} maxLength={60} className="mt-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
      </div>
      <button disabled={pending} className="rounded-xl bg-brand-ink px-4 py-2 text-sm font-bold text-white hover:bg-brand-emerald disabled:opacity-60">
        Adicionar
      </button>
      {state.status !== "idle" ? (
        <p role={state.status === "ok" ? "status" : "alert"} className={`w-full text-sm font-bold ${state.status === "ok" ? "text-brand-emerald" : "text-red-700"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
