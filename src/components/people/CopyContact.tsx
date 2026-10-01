"use client";

import { Copy } from "lucide-react";
import { useState } from "react";

/** "Copiar contato" (§105): nome, cargo, e-mail e telefone corporativos. */
export function CopyContact({ text }: { text: string }) {
  const [done, setDone] = useState<"idle" | "ok" | "fail">("idle");
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone("ok");
    } catch {
      setDone("fail");
    }
  };
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={copy} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-extrabold text-slate-800 hover:bg-slate-50">
        <Copy className="h-4 w-4" aria-hidden="true" />
        Copiar contato
      </button>
      <span role="status" className="text-sm font-bold text-brand-emerald">
        {done === "ok" ? "Contato copiado." : done === "fail" ? "Não foi possível copiar." : ""}
      </span>
    </span>
  );
}
