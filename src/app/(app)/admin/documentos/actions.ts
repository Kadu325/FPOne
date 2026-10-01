"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BusinessError, errorMessage } from "@/lib/errors";
import { MAX_DOCUMENT_BYTES } from "@/modules/documents/file";
import { clientIp } from "@/server/auth/ip";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { archiveDocument, deleteDraftDocument, documentMetaSchema, publishDocument, saveDocument, uploadVersion, type DocumentMetaInput } from "@/server/documents/admin";

export type DocResult = { ok: true; message: string; id?: string } | { ok: false; message: string };

function fail(e: unknown): DocResult {
  if (e instanceof BusinessError) return { ok: false, message: e.message !== e.code ? e.message : errorMessage(e.code) };
  throw e;
}

function refresh(id?: string) {
  revalidatePath("/admin/documentos");
  if (id) revalidatePath(`/admin/documentos/${id}`);
  revalidatePath("/documentos");
  revalidatePath("/");
}

const id = z.uuid();

export async function saveDocumentAction(docId: string | null, input: DocumentMetaInput): Promise<DocResult> {
  const parsed = documentMetaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Verifique os campos: título de 3 a 160 caracteres e categoria da lista." };
  if (docId !== null && !id.safeParse(docId).success) return { ok: false, message: errorMessage("ERR_VALIDATION") };
  try {
    const saved = await saveDocument(db(), await getCurrentUser(), docId, parsed.data, clientIp(await headers()));
    refresh(saved);
    return { ok: true, message: docId ? "Dados do documento salvos." : "Documento criado. Agora envie o arquivo.", id: saved };
  } catch (e) {
    return fail(e);
  }
}

export async function uploadVersionAction(_prev: DocResult | null, form: FormData): Promise<DocResult> {
  const docId = id.safeParse(form.get("documentId"));
  const file = form.get("file");
  if (!docId.success || !(file instanceof File)) return { ok: false, message: "Selecione um arquivo." };
  if (file.size > MAX_DOCUMENT_BYTES) return { ok: false, message: "O arquivo passa de 20 MB." };
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const version = await uploadVersion(db(), await getCurrentUser(), docId.data, file.name, bytes, new Date(), clientIp(await headers()));
    refresh(docId.data);
    return { ok: true, message: `Versão ${version} enviada.` };
  } catch (e) {
    return fail(e);
  }
}

export async function publishDocumentAction(docId: string): Promise<DocResult> {
  if (!id.safeParse(docId).success) return { ok: false, message: errorMessage("ERR_VALIDATION") };
  try {
    await publishDocument(db(), await getCurrentUser(), docId, new Date(), clientIp(await headers()));
    refresh(docId);
    return { ok: true, message: "Documento publicado." };
  } catch (e) {
    return fail(e);
  }
}

export async function archiveDocumentAction(docId: string): Promise<DocResult> {
  if (!id.safeParse(docId).success) return { ok: false, message: errorMessage("ERR_VALIDATION") };
  try {
    await archiveDocument(db(), await getCurrentUser(), docId, new Date(), clientIp(await headers()));
    refresh(docId);
    return { ok: true, message: "Documento arquivado. As versões continuam guardadas." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDocumentAction(docId: string): Promise<DocResult> {
  if (!id.safeParse(docId).success) return { ok: false, message: errorMessage("ERR_VALIDATION") };
  try {
    await deleteDraftDocument(db(), await getCurrentUser(), docId, clientIp(await headers()));
    refresh();
    return { ok: true, message: "Rascunho excluído." };
  } catch (e) {
    return fail(e);
  }
}
