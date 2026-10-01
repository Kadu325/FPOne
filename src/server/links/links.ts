import type { PrismaClient } from "@/generated/prisma/client";
import { audienceFilter, type AudienceSubject } from "@/server/authz/audience";

/** Links úteis (§162), lado do colaborador: sempre com audienceFilter. Gestão em ./admin.ts. */

export interface LinkItem {
  id: string;
  label: string;
  description: string;
  url: string;
}

/** Links ativos do público do usuário, na ordem configurada (RN-LNK-001..003). */
export async function listLinksForUser(prisma: PrismaClient, subject: AudienceSubject, limit = 50): Promise<LinkItem[]> {
  return prisma.usefulLink.findMany({
    where: { AND: [{ active: true }, audienceFilter(subject)] },
    select: { id: true, label: true, description: true, url: true },
    orderBy: [{ sortOrder: "asc" }, { label: "asc" }],
    take: limit,
  });
}

/** Destino de um link ativo do público do usuário; registra o clique sem guardar quem clicou. */
export async function openLink(prisma: PrismaClient, subject: AudienceSubject, id: string): Promise<string | null> {
  const link = await prisma.usefulLink.findFirst({ where: { AND: [{ id, active: true }, audienceFilter(subject)] }, select: { id: true, url: true } });
  if (!link) return null;
  await prisma.linkClick.create({ data: { linkId: link.id } }).catch(() => undefined);
  return link.url;
}
