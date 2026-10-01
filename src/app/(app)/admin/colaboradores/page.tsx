import type { Metadata } from "next";
import Link from "next/link";
import { ADMIN_NAME } from "@/lib/constants";
import { ROLE_LABELS } from "@/lib/roles";
import { StateMessage, Unauthorized } from "@/components/feedback/StateMessage";
import { can } from "@/server/authz/can";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { listEmployeesForAdmin } from "@/server/employees/list";
import { EmployeeActions } from "./EmployeeActions";
import { ImportPanel } from "./ImportPanel";

export const metadata: Metadata = { title: "Colaboradores" };
export const dynamic = "force-dynamic";

export default async function EmployeesAdminPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireUser();
  if (!can(user, "admin.access")) {
    return (
      <div className="px-4 py-16">
        <Unauthorized />
      </div>
    );
  }
  const { q = "" } = await searchParams;
  const { items, total } = await listEmployeesForAdmin(db(), user, q);
  const perms = {
    deactivate: can(user, "user.deactivate"),
    manageRoles: can(user, "user.manage_roles"),
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-widest text-brand-emerald">{ADMIN_NAME}</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-ink">Colaboradores</h1>
        </div>
        <Link href="/" className="text-sm font-semibold text-brand-emerald underline underline-offset-4">
          Voltar ao início
        </Link>
      </header>

      {can(user, "employee.import") ? <ImportPanel /> : null}

      <section aria-labelledby="lista" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 id="lista" className="text-xl font-bold text-brand-ink">
            Cadastro <span className="text-base font-semibold text-slate-600">({total})</span>
          </h2>
          <form role="search" className="flex gap-2">
            <label htmlFor="q" className="sr-only">
              Buscar por matrícula ou nome
            </label>
            <input id="q" name="q" defaultValue={q} placeholder="Matrícula ou nome" className="w-56 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm" />
            <button className="rounded-xl bg-brand-ink px-4 py-2 text-sm font-bold text-white">Buscar</button>
          </form>
        </div>

        {items.length === 0 ? (
          <StateMessage title={q ? "Nenhum colaborador encontrado" : "Nenhum colaborador cadastrado"}>
            {q ? "Tente outra matrícula ou nome." : "Importe o CSV de colaboradores para começar."}
          </StateMessage>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-card">
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">Colaboradores cadastrados (até 50 por busca)</caption>
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-700">
                <tr>
                  <th scope="col" className="px-4 py-3">Matrícula</th>
                  <th scope="col" className="px-4 py-3">Nome</th>
                  <th scope="col" className="px-4 py-3">Unidade</th>
                  <th scope="col" className="px-4 py-3">Situação</th>
                  <th scope="col" className="px-4 py-3">Perfis</th>
                  <th scope="col" className="px-4 py-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((e) => (
                  <tr key={e.id} className="align-top">
                    <td className="px-4 py-3 font-mono text-slate-800">{e.matricula}</td>
                    <td className="px-4 py-3 font-semibold text-brand-ink">
                      <Link href={`/admin/colaboradores/${e.id}`} className="hover:text-brand-emerald hover:underline">
                        {e.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {e.unit}
                      <br />
                      <span className="text-xs text-slate-600">{e.department}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {e.status === "ACTIVE" ? "Ativo" : "Inativo"}
                      <br />
                      <span className="text-xs text-slate-600">
                        {e.hasCorporateEmail ? "Acesso pelo AD" : "Sem e-mail corporativo: não entra pelo AD"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{e.roles.map((r) => ROLE_LABELS[r]).join(", ")}</td>
                    <td className="px-4 py-3">
                      <EmployeeActions employee={e} isSelf={e.userId === user.id} perms={perms} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
