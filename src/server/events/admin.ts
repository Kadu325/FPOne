import type { PrismaClient } from "@/generated/prisma/client";
import { z } from "zod";
import { AudienceType, type EventStatus } from "@/generated/prisma/enums";
import { BusinessError } from "@/lib/errors";
import { fromLocalInput } from "@/modules/publications/schema";
import { audit } from "@/server/audit/audit";
import { assertCan, type Actor } from "@/server/authz/can";
import { validAudiences } from "@/server/publications/rules";
import { assertEventDates, assertEventTransition, effectiveEventStatus } from "./rules";

const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Data e hora inválidas");

export const eventInputSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000),
  location: z.string().trim().max(160),
  startAt: localDateTime,
  endAt: localDateTime,
  audiences: z.array(z.object({ audienceType: z.enum(AudienceType), audienceId: z.string().trim().max(200).nullable() })).max(50),
});
export type EventInput = z.input<typeof eventInputSchema>;

export interface AdminEvent {
  id: string;
  title: string;
  description: string;
  location: string;
  startAt: Date;
  endAt: Date;
  status: EventStatus;
  audiences: { audienceType: AudienceType; audienceId: string | null }[];
}

export async function listEventsForAdmin(prisma: PrismaClient, actor: Actor | null, now: Date): Promise<AdminEvent[]> {
  assertCan(actor, "event.manage");
  const rows = await prisma.event.findMany({ include: { audiences: true }, orderBy: { startAt: "desc" }, take: 200 });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    description: r.description,
    location: r.location,
    startAt: r.startAt,
    endAt: r.endAt,
    status: effectiveEventStatus(r, now),
    audiences: r.audiences.map((a) => ({ audienceType: a.audienceType, audienceId: a.audienceType === "ALL" ? null : a.audienceId })),
  }));
}

function toData(input: z.output<typeof eventInputSchema>) {
  const startAt = fromLocalInput(input.startAt);
  const endAt = fromLocalInput(input.endAt);
  assertEventDates(startAt, endAt);
  const audiences = input.audiences.map((a) => ({ audienceType: a.audienceType, audienceId: a.audienceType === "ALL" ? null : a.audienceId }));
  if (!validAudiences(audiences)) throw new BusinessError("ERR_PUBLICATION_NO_AUDIENCE");
  return { title: input.title, description: input.description, location: input.location, startAt, endAt, audiences };
}

export async function saveEvent(prisma: PrismaClient, actor: Actor | null, id: string | null, input: z.output<typeof eventInputSchema>, now: Date, ip: string | null): Promise<string> {
  assertCan(actor, "event.manage");
  const { audiences, ...data } = toData(input);
  return prisma.$transaction(async (tx) => {
    let eventId: string;
    if (id) {
      const current = await tx.event.findUnique({ where: { id }, select: { status: true, endAt: true } });
      if (!current) throw new BusinessError("ERR_NOT_FOUND");
      const status = effectiveEventStatus(current, now);
      if (status === "CANCELLED" || status === "FINISHED") throw new BusinessError("ERR_PUBLICATION_NOT_EDITABLE");
      await tx.eventAudience.deleteMany({ where: { eventId: id } });
      await tx.event.update({ where: { id }, data: { ...data, updatedById: actor.id, audiences: { create: audiences } } });
      eventId = id;
    } else {
      const created = await tx.event.create({ data: { ...data, createdById: actor.id, updatedById: actor.id, audiences: { create: audiences } }, select: { id: true } });
      eventId = created.id;
    }
    await audit(tx, { actorId: actor.id, action: "EVENT_SAVED", entity: "event", entityId: eventId, metadata: { created: !id }, ip });
    return eventId;
  });
}

export async function publishEvent(prisma: PrismaClient, actor: Actor | null, id: string, now: Date, ip: string | null): Promise<void> {
  assertCan(actor, "event.manage");
  await prisma.$transaction(async (tx) => {
    const e = await tx.event.findUnique({ where: { id }, include: { audiences: true } });
    if (!e) throw new BusinessError("ERR_NOT_FOUND");
    assertEventTransition(effectiveEventStatus(e, now), "PUBLISHED");
    if (!validAudiences(e.audiences)) throw new BusinessError("ERR_PUBLICATION_NO_AUDIENCE");
    await tx.event.update({ where: { id }, data: { status: "PUBLISHED", updatedById: actor.id } });
    await audit(tx, { actorId: actor.id, action: "EVENT_PUBLISHED", entity: "event", entityId: id, ip });
  });
}

export async function cancelEvent(prisma: PrismaClient, actor: Actor | null, id: string, reason: string, now: Date, ip: string | null): Promise<void> {
  assertCan(actor, "event.manage");
  await prisma.$transaction(async (tx) => {
    const e = await tx.event.findUnique({ where: { id }, select: { status: true, endAt: true } });
    if (!e) throw new BusinessError("ERR_NOT_FOUND");
    assertEventTransition(effectiveEventStatus(e, now), "CANCELLED");
    await tx.event.update({ where: { id }, data: { status: "CANCELLED", cancelledAt: now, cancelReason: reason || null, updatedById: actor.id } });
    await audit(tx, { actorId: actor.id, action: "EVENT_CANCELLED", entity: "event", entityId: id, ip });
  });
}

export async function deleteDraftEvent(prisma: PrismaClient, actor: Actor | null, id: string, ip: string | null): Promise<void> {
  assertCan(actor, "event.manage");
  await prisma.$transaction(async (tx) => {
    const e = await tx.event.findUnique({ where: { id }, select: { status: true } });
    if (!e) throw new BusinessError("ERR_NOT_FOUND");
    if (e.status !== "DRAFT") throw new BusinessError("ERR_INVALID_TRANSITION");
    await tx.event.delete({ where: { id } });
    await audit(tx, { actorId: actor.id, action: "EVENT_DELETED", entity: "event", entityId: id, ip });
  });
}
