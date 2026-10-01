import type { PrismaClient } from "@/generated/prisma/client";
import { z } from "zod";
import { BusinessError } from "@/lib/errors";
import { audit } from "@/server/audit/audit";
import { assertCan, type Actor } from "@/server/authz/can";

/**
 * Administração de perfis (§104). Cargo, departamento e unidade continuam vindo só da carga CSV
 * (RN-PROF-002). Aqui: telefone corporativo (RN-PROF-003) e responsabilidades (RN-PROF-006).
 */

export const phoneSchema = z
  .string()
  .trim()
  .max(20)
  .refine((v) => v === "" || /^[0-9+()\s.-]{8,20}$/.test(v), "Telefone inválido")
  .transform((v) => (v === "" ? null : v));

export const responsibilitiesSchema = z
  .array(
    z.object({
      responsibility: z.string().trim().min(2).max(120),
      keywords: z.array(z.string().trim().min(2).max(40)).max(15),
      isPrimary: z.boolean(),
    }),
  )
  .max(30);

export type ResponsibilityInput = z.input<typeof responsibilitiesSchema>[number];

export async function updateCorporatePhone(prisma: PrismaClient, actor: Actor | null, employeeId: string, phone: string | null, ip: string | null): Promise<void> {
  assertCan(actor, "employee.update");
  await prisma.$transaction(async (tx) => {
    const e = await tx.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
    if (!e) throw new BusinessError("ERR_NOT_FOUND");
    await tx.employee.update({ where: { id: employeeId }, data: { corporatePhone: phone } });
    await audit(tx, { actorId: actor.id, action: "EMPLOYEE_CONTACT_UPDATED", entity: "employee", entityId: employeeId, ip });
  });
}

/** Substitui a lista inteira (cadastro validado por perfil autorizado, RN-PROF-006). */
export async function setResponsibilities(
  prisma: PrismaClient,
  actor: Actor | null,
  employeeId: string,
  list: z.output<typeof responsibilitiesSchema>,
  ip: string | null,
): Promise<void> {
  assertCan(actor, "responsibility.manage");
  await prisma.$transaction(async (tx) => {
    const e = await tx.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
    if (!e) throw new BusinessError("ERR_NOT_FOUND");
    await tx.employeeResponsibility.deleteMany({ where: { employeeId } });
    if (list.length > 0) {
      await tx.employeeResponsibility.createMany({
        data: list.map((r) => ({ employeeId, responsibility: r.responsibility, keywords: [...new Set(r.keywords)], isPrimary: r.isPrimary })),
      });
    }
    await audit(tx, {
      actorId: actor.id,
      action: "RESPONSIBILITIES_UPDATED",
      entity: "employee",
      entityId: employeeId,
      metadata: { count: list.length, responsibilities: list.map((r) => r.responsibility) },
      ip,
    });
  });
}
