"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PublicationType } from "@/generated/prisma/enums";
import { BusinessError, errorMessage } from "@/lib/errors";
import { fromLocalInput, publicationInputSchema, type PublicationInput } from "@/modules/publications/schema";
import { clientIp } from "@/server/auth/ip";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { archive, createCategory, createPublication, deleteDraft, publishNow, schedule, unschedule, updatePublication } from "@/server/publications/admin";

/**
 * Ações da Central de Publicações (§77). Cada uma revalida entrada (Zod), permissão (assertCan
 * no service) e regra de negócio no servidor; o front só esconde botões por cosmética.
 */

export type AdminResult = { ok: true; message: string; id?: string } | { ok: false; message: string };

function fail(e: unknown): AdminResult {
  if (e instanceof BusinessError) return { ok: false, message: e.message !== e.code ? e.message : errorMessage(e.code) };
  throw e;
}

async function context() {
  const actor = await getCurrentUser();
  if (!actor) throw new BusinessError("ERR_UNAUTHORIZED");
  return { actor, ip: clientIp(await headers()), now: new Date() };
}

function refresh(id?: string) {
  revalidatePath("/admin/publicacoes");
  if (id) revalidatePath(`/admin/publicacoes/${id}`);
  revalidatePath("/");
  revalidatePath("/comunicados");
  revalidatePath("/novidades");
}

const id = z.uuid();

export async function savePublicationAction(publicationId: string | null, input: PublicationInput, material: boolean): Promise<AdminResult> {
  const parsed = publicationInputSchema.safeParse(input);
  const parsedId = publicationId === null ? null : id.safeParse(publicationId);
  if (!parsed.success || (parsedId && !parsedId.success) || typeof material !== "boolean") return { ok: false, message: errorMessage("ERR_VALIDATION") };
  try {
    const { actor, ip, now } = await context();
    if (parsedId?.success) {
      await updatePublication(db(), actor, parsedId.data, parsed.data, material, now, ip);
      refresh(parsedId.data);
      return { ok: true, message: "Alterações salvas.", id: parsedId.data };
    }
    const created = await createPublication(db(), actor, parsed.data, ip);
    refresh(created);
    return { ok: true, message: "Rascunho criado.", id: created };
  } catch (e) {
    return fail(e);
  }
}

export async function publishAction(publicationId: string): Promise<AdminResult> {
  const parsed = id.safeParse(publicationId);
  if (!parsed.success) return { ok: false, message: errorMessage("ERR_VALIDATION") };
  try {
    const { actor, ip, now } = await context();
    await publishNow(db(), actor, parsed.data, now, ip);
    refresh(parsed.data);
    return { ok: true, message: "Publicado." };
  } catch (e) {
    return fail(e);
  }
}

export async function scheduleAction(publicationId: string, publishAtLocal: string): Promise<AdminResult> {
  const parsed = z.object({ id, at: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/) }).safeParse({ id: publicationId, at: publishAtLocal });
  if (!parsed.success) return { ok: false, message: errorMessage("ERR_INVALID_SCHEDULE") };
  try {
    const { actor, ip, now } = await context();
    await schedule(db(), actor, parsed.data.id, fromLocalInput(parsed.data.at), now, ip);
    refresh(parsed.data.id);
    return { ok: true, message: "Publicação agendada." };
  } catch (e) {
    return fail(e);
  }
}

export async function unscheduleAction(publicationId: string): Promise<AdminResult> {
  const parsed = id.safeParse(publicationId);
  if (!parsed.success) return { ok: false, message: errorMessage("ERR_VALIDATION") };
  try {
    const { actor, ip, now } = await context();
    await unschedule(db(), actor, parsed.data, now, ip);
    refresh(parsed.data);
    return { ok: true, message: "Agendamento cancelado. A publicação voltou a rascunho." };
  } catch (e) {
    return fail(e);
  }
}

export async function archiveAction(publicationId: string): Promise<AdminResult> {
  const parsed = id.safeParse(publicationId);
  if (!parsed.success) return { ok: false, message: errorMessage("ERR_VALIDATION") };
  try {
    const { actor, ip, now } = await context();
    await archive(db(), actor, parsed.data, now, ip);
    refresh(parsed.data);
    return { ok: true, message: "Publicação arquivada. Métricas e histórico foram preservados." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDraftAction(publicationId: string): Promise<AdminResult> {
  const parsed = id.safeParse(publicationId);
  if (!parsed.success) return { ok: false, message: errorMessage("ERR_VALIDATION") };
  try {
    const { actor, ip } = await context();
    await deleteDraft(db(), actor, parsed.data, ip);
    refresh();
    return { ok: true, message: "Rascunho excluído." };
  } catch (e) {
    return fail(e);
  }
}

export type CategoryState = { status: "idle" } | { status: "ok"; message: string } | { status: "error"; message: string };

export async function createCategoryAction(_prev: CategoryState, form: FormData): Promise<CategoryState> {
  const parsed = z.object({ type: z.enum(PublicationType), name: z.string().trim().min(2).max(60) }).safeParse({ type: form.get("type"), name: form.get("name") });
  if (!parsed.success) return { status: "error", message: "Informe o tipo e um nome de 2 a 60 caracteres." };
  try {
    const { actor, ip } = await context();
    await createCategory(db(), actor, parsed.data.type, parsed.data.name, ip);
    revalidatePath("/admin/publicacoes/categorias");
    return { status: "ok", message: "Categoria criada." };
  } catch (e) {
    const r = fail(e);
    return { status: "error", message: r.message };
  }
}
