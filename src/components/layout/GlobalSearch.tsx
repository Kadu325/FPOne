import { Search } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

/**
 * Busca global no topbar (§89, §163). Formulário GET para /busca: funciona sem JavaScript e a
 * autorização dos resultados é toda no servidor. No mobile, a busca fica na barra inferior.
 */
export function GlobalSearch() {
  return (
    <form role="search" action="/busca" className="relative hidden lg:block">
      <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
      <label htmlFor="global-search" className="sr-only">
        Buscar na {APP_NAME}
      </label>
      <input
        id="global-search"
        name="q"
        type="search"
        maxLength={200}
        placeholder="Buscar pessoas, documentos…"
        className="w-72 rounded-2xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-800 placeholder:text-slate-500 focus:bg-white"
      />
    </form>
  );
}
