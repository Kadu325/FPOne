"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BusinessError, errorMessage } from "@/lib/errors";
import { clientIp } from "@/server/auth/ip";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { cancelEvent, deleteDraftEvent, eventInputSchema, publishEvent, saveEvent, type EventInput } from "@/server/events/admin";

export type EventResult = { ok: true; message: string } | { ok: false; message: string };

function fail(e: unknown): EventResult {
  if (e instanceof BusinessError) return { ok: false, message: e.message !== e.code ? e.message : errorMessage(e.code) };
  throw e;
}

function refresh() {
  revalidatePath("/admin/agenda");
  revalidatePath("/agenda");
  revalidatePath("/");
}

const id = z.uuid();

export async function saveEventAction(eventId: string | null, input: EventInput): Promise<EventResult> {
  const parsed = eventInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Verifique os campos: título de 3 a 160 caracteres, início e término preenchidos." };
  if (eventId !== null && !id.safeParse(eventId).success) return { ok: false, message: errorMessage("ERR_VALIDATION") };
  try {
    await saveEvent(db(), await getCurrentUser(), eventId, parsed.data, new Date(), clientIp(await headers()));
    refresh();
    return { ok: true, message: eventId ? "Evento atualizado." : "Evento salvo como rascunho." };
  } catch (e) {
    return fail(e);
  }
}

export async function publishEventAction(eventId: string): Promise<EventResult> {
  if (!id.safeParse(eventId).success) return { ok: false, message: errorMessage("ERR_VALIDATION") };
  try {
    await publishEvent(db(), await getCurrentUser(), eventId, new Date(), clientIp(await headers()));
    refresh();
    return { ok: true, message: "Evento publicado na agenda." };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelEventAction(eventId: string, reason: string): Promise<EventResult> {
  const parsed = z.object({ id, reason: z.string().trim().max(300) }).safeParse({ id: eventId, reason });
  if (!parsed.success) return { ok: false, message: errorMessage("ERR_VALIDATION") };
  try {
    await cancelEvent(db(), await getCurrentUser(), parsed.data.id, parsed.data.reason, new Date(), clientIp(await headers()));
    refresh();
    return { ok: true, message: "Evento cancelado. Ele continua na agenda com a indicação de cancelamento." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteEventAction(eventId: string): Promise<EventResult> {
  if (!id.safeParse(eventId).success) return { ok: false, message: errorMessage("ERR_VALIDATION") };
  try {
    await deleteDraftEvent(db(), await getCurrentUser(), eventId, clientIp(await headers()));
    refresh();
    return { ok: true, message: "Rascunho excluído." };
  } catch (e) {
    return fail(e);
  }
}
