import { z } from "zod";
import { AudienceType, PublicationType } from "@/generated/prisma/enums";
import { richDocSchema } from "./content";

/** America/Bahia é UTC−3 fixo. Campos datetime-local chegam no horário corporativo. */
const BAHIA_OFFSET = "-03:00";
const localDateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export function fromLocalInput(value: string): Date {
  return new Date(`${value}:00${BAHIA_OFFSET}`);
}

/** Inverso de fromLocalInput, para preencher o formulário. */
export function toLocalInput(date: Date): string {
  const shifted = new Date(date.getTime() - 3 * 3_600_000);
  return shifted.toISOString().slice(0, 16);
}

const optionalLocal = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .pipe(z.string().regex(localDateTime).nullable());

export const audienceInputSchema = z.object({
  audienceType: z.enum(AudienceType),
  audienceId: z.string().trim().max(200).nullable(),
});

/** Entrada do editor (Server Action). Tudo revalidado no servidor (CLAUDE.md: Zod em toda entrada). */
export const publicationInputSchema = z.object({
  type: z.enum(PublicationType),
  title: z.string().trim().max(200),
  summary: z.string().trim().max(500),
  content: richDocSchema,
  categoryId: z.string().uuid().nullable(),
  isFeatured: z.boolean(),
  pinned: z.boolean(),
  requiresAcknowledgement: z.boolean(),
  audiences: z.array(audienceInputSchema).max(50),
  publishAt: optionalLocal,
  expiresAt: optionalLocal,
});

export type PublicationInput = z.input<typeof publicationInputSchema>;
export type ParsedPublicationInput = z.output<typeof publicationInputSchema>;
