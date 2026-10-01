import type { PrismaClient } from "@/generated/prisma/client";
import { zonedParts } from "@/modules/home/time";

/**
 * Coleta mínima para os indicadores (§43, RN-KPI-001, decisão da Fase 7). Nada aqui guarda
 * páginas, horários de navegação, texto de busca ou quem clicou em um link.
 */

/** Dia corrente em America/Bahia como data (meia-noite UTC do dia local, para a coluna DATE). */
export function activityDay(now: Date): Date {
  const { year, month, day } = zonedParts(now);
  return new Date(Date.UTC(year, month - 1, day));
}

/** Evita uma escrita por requisição: cada processo lembra quem já foi registrado no dia. */
const seen = new Set<string>();
const SEEN_LIMIT = 50_000;

/** Marca o usuário como ativo hoje (no máximo uma linha por usuário por dia). Nunca quebra a página. */
export async function recordActivity(prisma: PrismaClient, userId: string, now: Date): Promise<void> {
  const day = activityDay(now);
  const key = `${userId}:${day.toISOString().slice(0, 10)}`;
  if (seen.has(key)) return;
  try {
    await prisma.userActivityDay.createMany({ data: [{ userId, day }], skipDuplicates: true });
    if (seen.size > SEEN_LIMIT) seen.clear();
    seen.add(key);
  } catch {
    // Indicador é secundário: falha de coleta não pode impedir o uso da intranet.
  }
}

/** Conta a busca e quantos resultados teve; o texto pesquisado não é guardado. */
export async function recordSearch(prisma: PrismaClient, resultCount: number): Promise<void> {
  try {
    await prisma.searchEvent.create({ data: { resultCount } });
  } catch {
    // idem
  }
}
