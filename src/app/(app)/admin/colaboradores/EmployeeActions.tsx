"use client";

import { useState, useTransition } from "react";
import type { Role } from "@/generated/prisma/enums";
import { ASSIGNABLE_ROLES, ROLE_LABELS } from "@/lib/roles";
import type { EmployeeListItem } from "@/server/employees/list";
import { setActiveAction, setRolesAction, type ActionResult } from "./actions";

interface Props {
  employee: EmployeeListItem;
  isSelf: boolean;
  perms: { deactivate: boolean; manageRoles: boolean };
}

const linkButton = "inline-flex min-h-6 items-center text-left text-xs font-bold text-brand-emerald underline underline-offset-4 disabled:opacity-60";

export function EmployeeActions({ employee, isSelf, perms }: Props) {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const [editingRoles, setEditingRoles] = useState(false);
  const [roles, setRoles] = useState<Role[]>(employee.roles.filter((r) => r !== "EMPLOYEE"));

  const run = (fn: () => Promise<ActionResult>) => start(async () => setResult(await fn()));
  const confirmThen = (message: string, fn: () => Promise<ActionResult>) => {
    if (window.confirm(message)) run(fn);
  };

  return (
    <div className="flex flex-col gap-1.5">
      {perms.deactivate && !isSelf ? (
        <button
          type="button"
          disabled={pending}
          className={linkButton}
          onClick={() =>
            employee.status === "ACTIVE"
              ? confirmThen(`Inativar ${employee.name}? O acesso será encerrado.`, () => setActiveAction(employee.id, false))
              : run(() => setActiveAction(employee.id, true))
          }
        >
          {employee.status === "ACTIVE" ? "Inativar" : "Reativar"}
        </button>
      ) : null}
      {perms.manageRoles && !isSelf && employee.userId ? (
        editingRoles ? (
          <fieldset className="mt-1 space-y-1 rounded-lg border border-slate-200 p-2">
            <legend className="px-1 text-xs font-bold text-slate-700">Perfis adicionais</legend>
            {ASSIGNABLE_ROLES.map((r) => (
              <label key={r} className="flex min-h-6 items-center gap-2 text-xs text-slate-800">
                <input
                  type="checkbox"
                  checked={roles.includes(r)}
                  onChange={(e) => setRoles((cur) => (e.target.checked ? [...cur, r] : cur.filter((x) => x !== r)))}
                />
                {ROLE_LABELS[r]}
              </label>
            ))}
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                disabled={pending}
                className={linkButton}
                onClick={() => {
                  const userId = employee.userId;
                  if (userId) run(() => setRolesAction(userId, roles));
                  setEditingRoles(false);
                }}
              >
                Salvar
              </button>
              <button type="button" className="inline-flex min-h-6 items-center text-xs font-bold text-slate-700 underline underline-offset-4" onClick={() => setEditingRoles(false)}>
                Cancelar
              </button>
            </div>
          </fieldset>
        ) : (
          <button type="button" className={linkButton} onClick={() => setEditingRoles(true)}>
            Alterar perfis
          </button>
        )
      ) : null}
      {result ? (
        <p role="status" className={`text-xs font-semibold ${result.ok ? "text-brand-emerald" : "text-red-700"}`}>
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
