"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BusinessError, errorMessage } from "@/lib/errors";
import { clientIp } from "@/server/auth/ip";
import { requireUser } from "@/server/auth/session";
import { loadAudienceSubject } from "@/server/authz/audience";
import { db } from "@/server/db";
import { acknowledge } from "@/server/publications/feed";

export type AckState = { status: "idle" } | { status: "done" } | { status: "error"; message: string };

/** POST /publications/:id/acknowledge (§77). Audiência e vigência revalidadas no servidor. */
export async function acknowledgeAction(_prev: AckState, form: FormData): Promise<AckState> {
  const parsed = z.string().uuid().safeParse(form.get("id"));
  if (!parsed.success) return { status: "error", message: errorMessage("ERR_VALIDATION") };
  const user = await requireUser();
  try {
    const subject = await loadAudienceSubject(db(), user.id);
    if (!subject) throw new BusinessError("ERR_NOT_FOUND");
    await acknowledge(db(), subject, parsed.data, new Date(), clientIp(await headers()));
    revalidatePath("/");
    revalidatePath("/comunicados");
    return { status: "done" };
  } catch (e) {
    if (e instanceof BusinessError) return { status: "error", message: errorMessage(e.code) };
    throw e;
  }
}
