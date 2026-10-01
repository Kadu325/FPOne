"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BusinessError, errorMessage } from "@/lib/errors";
import { clientIp } from "@/server/auth/ip";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { deleteLink, linkInputSchema, moveLink, saveLink, type LinkInput } from "@/server/links/admin";

export type LinkResult = { ok: true; message: string } | { ok: false; message: string };

function fail(e: unknown): LinkResult {
  if (e instanceof BusinessError) return { ok: false, message: e.message !== e.code ? e.message : errorMessage(e.code) };
  throw e;
}

function refresh() {
  revalidatePath("/admin/links");
  revalidatePath("/links");
  revalidatePath("/");
}

const id = z.uuid();

export async function saveLinkAction(linkId: string | null, input: LinkInput): Promise<LinkResult> {
  const parsed = linkInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? errorMessage("ERR_VALIDATION") };
  if (linkId !== null && !id.safeParse(linkId).success) return { ok: false, message: errorMessage("ERR_VALIDATION") };
  try {
    await saveLink(db(), await getCurrentUser(), linkId, parsed.data, clientIp(await headers()));
    refresh();
    return { ok: true, message: linkId ? "Link atualizado." : "Link criado." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteLinkAction(linkId: string): Promise<LinkResult> {
  if (!id.safeParse(linkId).success) return { ok: false, message: errorMessage("ERR_VALIDATION") };
  try {
    await deleteLink(db(), await getCurrentUser(), linkId, clientIp(await headers()));
    refresh();
    return { ok: true, message: "Link excluído." };
  } catch (e) {
    return fail(e);
  }
}

export async function moveLinkAction(linkId: string, direction: "up" | "down"): Promise<LinkResult> {
  if (!id.safeParse(linkId).success || (direction !== "up" && direction !== "down")) return { ok: false, message: errorMessage("ERR_VALIDATION") };
  try {
    await moveLink(db(), await getCurrentUser(), linkId, direction);
    refresh();
    return { ok: true, message: "Ordem atualizada." };
  } catch (e) {
    return fail(e);
  }
}
