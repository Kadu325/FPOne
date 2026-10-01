import { z } from "zod";

/**
 * Conteúdo de publicação: documento TipTap restrito aos recursos do §63 (sem imagem até o
 * storage da Fase 6). Validado no servidor antes de gravar; renderizado por RichContent sem
 * HTML cru. Qualquer nó ou marca fora desta lista é rejeitado.
 */

/** Só https e mailto (RN-BAN-006 aplicada também a links de conteúdo). */
export function isSafeHref(href: string): boolean {
  try {
    const url = new URL(href);
    return url.protocol === "https:" || url.protocol === "mailto:";
  } catch {
    return false;
  }
}

const markSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({
    type: z.literal("link"),
    attrs: z.object({ href: z.string().max(2000).refine(isSafeHref, "Link inválido: use https:// ou mailto:") }).loose(),
  }),
]);

export type RichMark = z.infer<typeof markSchema>;

export type RichNode =
  | { type: "text"; text: string; marks?: RichMark[] }
  | { type: "paragraph"; content?: RichNode[] }
  | { type: "heading"; attrs: { level: 2 | 3 }; content?: RichNode[] }
  | { type: "bulletList" | "orderedList"; content?: RichNode[] }
  | { type: "listItem"; content?: RichNode[] }
  | { type: "blockquote"; content?: RichNode[] }
  | { type: "horizontalRule" }
  | { type: "hardBreak" };

export interface RichDoc {
  type: "doc";
  content?: RichNode[];
}

const MAX_TEXT = 20_000;

const nodeSchema: z.ZodType<RichNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.object({ type: z.literal("text"), text: z.string().max(MAX_TEXT), marks: z.array(markSchema).max(5).optional() }),
    z.object({ type: z.literal("paragraph"), content: z.array(nodeSchema).optional() }),
    z.object({ type: z.literal("heading"), attrs: z.object({ level: z.union([z.literal(2), z.literal(3)]) }).loose(), content: z.array(nodeSchema).optional() }),
    z.object({ type: z.enum(["bulletList", "orderedList"]), content: z.array(nodeSchema).optional() }),
    z.object({ type: z.literal("listItem"), content: z.array(nodeSchema).optional() }),
    z.object({ type: z.literal("blockquote"), content: z.array(nodeSchema).optional() }),
    z.object({ type: z.literal("horizontalRule") }),
    z.object({ type: z.literal("hardBreak") }),
  ]),
);

export const richDocSchema: z.ZodType<RichDoc> = z.object({
  type: z.literal("doc"),
  content: z.array(nodeSchema).max(2000).optional(),
});

export const EMPTY_DOC: RichDoc = { type: "doc", content: [{ type: "paragraph" }] };

export function plainText(doc: RichDoc): string {
  const walk = (nodes: readonly RichNode[] | undefined): string =>
    (nodes ?? []).map((n) => (n.type === "text" ? n.text : "content" in n ? `${walk(n.content)} ` : " ")).join("");
  return walk(doc.content).replace(/\s+/g, " ").trim();
}

/** Lê o JSON do banco de forma segura: conteúdo inválido vira documento vazio, nunca HTML. */
export function parseStoredDoc(value: unknown): RichDoc {
  const parsed = richDocSchema.safeParse(value);
  return parsed.success ? parsed.data : EMPTY_DOC;
}
