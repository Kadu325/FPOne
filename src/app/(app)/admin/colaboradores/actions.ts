"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Role } from "@/generated/prisma/enums";
import { serverEnv } from "@/lib/env";
import { BusinessError, errorMessage } from "@/lib/errors";
import { adminSetEmployeeActive, adminSetUserRoles } from "@/server/admin/users";
import { clientIp } from "@/server/auth/ip";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { MAX_CSV_BYTES, errorsToCsv, parseEmployeesCsv, type RowError } from "@/server/employees/csv";
import { importEmployees, type ImportSummary } from "@/server/employees/import";
import { phoneSchema, responsibilitiesSchema, setResponsibilities, updateCorporatePhone, type ResponsibilityInput } from "@/server/people/admin";

export type ImportState =
  | { status: "idle" }
  | { status: "ok"; summary: ImportSummary }
  | { status: "invalid"; errors: RowError[]; errorsCsv: string }
  | { status: "error"; message: string };

export type ActionResult = { ok: true; message: string } | { ok: false; message: string };

function toMessage(e: unknown): string {
  if (e instanceof BusinessError) return e.message !== e.code ? e.message : errorMessage(e.code);
  throw e;
}

export async function importEmployeesAction(_prev: ImportState, form: FormData): Promise<ImportState> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { status: "error", message: "Selecione um arquivo CSV." };
  if (file.size > MAX_CSV_BYTES) return { status: "error", message: "O arquivo passa de 5 MB." };
  if (!/\.csv$/i.test(file.name)) return { status: "error", message: "Envie um arquivo .csv." };

  try {
    const parsed = parseEmployeesCsv(await file.text());
    const result = await importEmployees(db(), await getCurrentUser(), parsed, serverEnv().CPF_PEPPER, clientIp(await headers()));
    if (!result.ok) return { status: "invalid", errors: result.errors.slice(0, 200), errorsCsv: errorsToCsv(result.errors) };
    revalidatePath("/admin/colaboradores");
    return { status: "ok", summary: result.summary };
  } catch (e) {
    return { status: "error", message: toMessage(e) };
  }
}

const id = z.uuid();

export async function setActiveAction(employeeId: string, active: boolean): Promise<ActionResult> {
  const parsed = z.object({ employeeId: id, active: z.boolean() }).safeParse({ employeeId, active });
  if (!parsed.success) return { ok: false, message: errorMessage("ERR_VALIDATION") };
  try {
    await adminSetEmployeeActive(db(), await getCurrentUser(), parsed.data.employeeId, parsed.data.active, clientIp(await headers()));
    revalidatePath("/admin/colaboradores");
    return { ok: true, message: active ? "Colaborador reativado." : "Colaborador inativado. As sessões abertas foram encerradas." };
  } catch (e) {
    return { ok: false, message: toMessage(e) };
  }
}

export async function setRolesAction(userId: string, roles: string[]): Promise<ActionResult> {
  const parsed = z.object({ userId: id, roles: z.array(z.enum(Role)) }).safeParse({ userId, roles });
  if (!parsed.success) return { ok: false, message: errorMessage("ERR_VALIDATION") };
  try {
    await adminSetUserRoles(db(), await getCurrentUser(), parsed.data.userId, parsed.data.roles, clientIp(await headers()));
    revalidatePath("/admin/colaboradores");
    return { ok: true, message: "Perfis atualizados." };
  } catch (e) {
    return { ok: false, message: toMessage(e) };
  }
}

function refreshPerson(employeeId: string) {
  revalidatePath(`/admin/colaboradores/${employeeId}`);
  revalidatePath(`/pessoas/${employeeId}`);
  revalidatePath("/pessoas");
}

export async function updatePhoneAction(employeeId: string, phone: string): Promise<ActionResult> {
  const parsed = z.object({ employeeId: id, phone: phoneSchema }).safeParse({ employeeId, phone });
  if (!parsed.success) return { ok: false, message: "Telefone inválido: use de 8 a 20 dígitos, espaços, +, (, ), . ou -." };
  try {
    await updateCorporatePhone(db(), await getCurrentUser(), parsed.data.employeeId, parsed.data.phone, clientIp(await headers()));
    refreshPerson(parsed.data.employeeId);
    return { ok: true, message: "Telefone corporativo atualizado." };
  } catch (e) {
    return { ok: false, message: toMessage(e) };
  }
}

export async function setResponsibilitiesAction(employeeId: string, list: ResponsibilityInput[]): Promise<ActionResult> {
  const parsed = z.object({ employeeId: id, list: responsibilitiesSchema }).safeParse({ employeeId, list });
  if (!parsed.success) return { ok: false, message: "Verifique as responsabilidades: nome de 2 a 120 caracteres e palavras-chave de 2 a 40." };
  try {
    await setResponsibilities(db(), await getCurrentUser(), parsed.data.employeeId, parsed.data.list, clientIp(await headers()));
    refreshPerson(parsed.data.employeeId);
    return { ok: true, message: "Responsabilidades salvas." };
  } catch (e) {
    return { ok: false, message: toMessage(e) };
  }
}
