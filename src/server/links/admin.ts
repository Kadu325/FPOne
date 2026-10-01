import type { PrismaClient } from "@/generated/prisma/client";
import { z } from "zod";
import { AudienceType } from "@/generated/prisma/enums";
import { BusinessError } from "@/lib/errors";
import { isSafeLinkUrl } from "@/modules/links/url";
import { audit } from "@/server/audit/audit";
import { assertCan, type Actor } from "@/server/authz/can";
import { validAudiences } from "@/server/publications/rules";
import type { LinkItem } from "./links";

/**
 * FPOne Admin › Links úteis (§162). Exceção da RN-CORE-002: gestão vê todos os links, só com
 * link.manage (assertCan em cada função). Listado em ALLOWED na guarda de audiência.
 */

export const linkInputSchema = z.object({
  label: z.string().trim().min(2).max(60),
  description: z.string().trim().max(120),
  url: z.string().trim().max(2000).refine(isSafeLinkUrl, "Use http://, https:// ou uma rota interna iniciada por /."),
  active: z.boolean(),
  audiences: z.array(z.object({ audienceType: z.enum(AudienceType), audienceId: z.string().trim().max(200).nullable() })).max(50),
});
export type LinkInput = z.input<typeof linkInputSchema>;

export interface AdminLink extends LinkItem {
  active: boolean;
  sortOrder: number;
  owner: string;
  audiences: { audienceType: AudienceType; audienceId: string | null }[];
}

export async function listLinksForAdmin(prisma: PrismaClient, actor: Actor | null): Promise<AdminLink[]> {
  assertCan(actor, "link.manage");
  const rows = await prisma.usefulLink.findMany({
    include: { audiences: true, owner: { select: { employee: { select: { name: true } } } } },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    description: r.description,
    url: r.url,
    active: r.active,
    sortOrder: r.sortOrder,
    owner: r.owner.employee.name,
    audiences: r.audiences.map((a) => ({ audienceType: a.audienceType, audienceId: a.audienceType === "ALL" ? null : a.audienceId })),
  }));
}

function normalizedAudiences(input: z.output<typeof linkInputSchema>) {
  const list = input.audiences.map((a) => ({ audienceType: a.audienceType, audienceId: a.audienceType === "ALL" ? null : a.audienceId }));
  if (!validAudiences(list)) throw new BusinessError("ERR_PUBLICATION_NO_AUDIENCE");
  return list;
}

/** Cria ou edita. Quem salva vira o responsável administrativo (RN-LNK-006). */
export async function saveLink(prisma: PrismaClient, actor: Actor | null, id: string | null, input: z.output<typeof linkInputSchema>, ip: string | null): Promise<string> {
  assertCan(actor, "link.manage");
  const audiences = normalizedAudiences(input);
  return prisma.$transaction(async (tx) => {
    const data = { label: input.label, description: input.description, url: input.url, active: input.active, ownerId: actor.id };
    let linkId: string;
    if (id) {
      const exists = await tx.usefulLink.findUnique({ where: { id }, select: { id: true } });
      if (!exists) throw new BusinessError("ERR_NOT_FOUND");
      await tx.usefulLinkAudience.deleteMany({ where: { linkId: id } });
      await tx.usefulLink.update({ where: { id }, data: { ...data, audiences: { create: audiences } } });
      linkId = id;
    } else {
      const last = await tx.usefulLink.aggregate({ _max: { sortOrder: true } });
      const created = await tx.usefulLink.create({ data: { ...data, sortOrder: (last._max.sortOrder ?? 0) + 1, audiences: { create: audiences } }, select: { id: true } });
      linkId = created.id;
    }
    await audit(tx, { actorId: actor.id, action: "LINK_SAVED", entity: "useful_link", entityId: linkId, metadata: { created: !id, active: input.active }, ip });
    return linkId;
  });
}

export async function deleteLink(prisma: PrismaClient, actor: Actor | null, id: string, ip: string | null): Promise<void> {
  assertCan(actor, "link.manage");
  await prisma.$transaction(async (tx) => {
    const link = await tx.usefulLink.findUnique({ where: { id }, select: { label: true } });
    if (!link) throw new BusinessError("ERR_NOT_FOUND");
    await tx.usefulLink.delete({ where: { id } });
    await audit(tx, { actorId: actor.id, action: "LINK_DELETED", entity: "useful_link", entityId: id, metadata: { label: link.label }, ip });
  });
}

/** Troca a posição com o vizinho (RN-LNK-003). */
export async function moveLink(prisma: PrismaClient, actor: Actor | null, id: string, direction: "up" | "down"): Promise<void> {
  assertCan(actor, "link.manage");
  await prisma.$transaction(async (tx) => {
    const all = await tx.usefulLink.findMany({ select: { id: true }, orderBy: [{ sortOrder: "asc" }, { label: "asc" }] });
    const i = all.findIndex((l) => l.id === id);
    const j = direction === "up" ? i - 1 : i + 1;
    if (i < 0) throw new BusinessError("ERR_NOT_FOUND");
    if (j < 0 || j >= all.length) return;
    const order = all.map((l) => l.id);
    [order[i], order[j]] = [order[j] as string, order[i] as string];
    await Promise.all(order.map((linkId, index) => tx.usefulLink.update({ where: { id: linkId }, data: { sortOrder: index + 1 } })));
  });
}
