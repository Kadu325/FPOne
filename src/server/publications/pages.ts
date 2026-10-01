import "server-only";
import { notFound } from "next/navigation";
import type { PublicationType } from "@/generated/prisma/enums";
import { BusinessError } from "@/lib/errors";
import type { CurrentUser } from "@/server/auth/session";
import { loadAudienceSubject } from "@/server/authz/audience";
import { db } from "@/server/db";
import { getFeedDetail, listFeed, registerView, type FeedDetail, type FeedItem } from "./feed";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Helpers das páginas de leitura. Sem cadastro ativo, nada é exibido (RN-CORE-002). */
export async function loadFeedPage(user: CurrentUser, type: PublicationType, now: Date, categoryId?: string): Promise<FeedItem[]> {
  const subject = await loadAudienceSubject(db(), user.id);
  return subject ? listFeed(db(), subject, { type, now, categoryId }) : [];
}

/** Detalhe + registro de visualização (RN-COM-015). Fora do público: 404, sem revelar existência. */
export async function loadDetailPage(user: CurrentUser, type: PublicationType, id: string, now: Date): Promise<FeedDetail> {
  const subject = await loadAudienceSubject(db(), user.id);
  if (!subject || !UUID.test(id)) notFound();
  try {
    const item = await getFeedDetail(db(), subject, id, now);
    if (item.type !== type) notFound();
    await registerView(db(), subject, id, now);
    return item;
  } catch (e) {
    if (e instanceof BusinessError && e.code === "ERR_NOT_FOUND") notFound();
    throw e;
  }
}
