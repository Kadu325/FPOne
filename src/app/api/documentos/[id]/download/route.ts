import { NextResponse, type NextRequest } from "next/server";
import { BusinessError } from "@/lib/errors";
import { clientIp } from "@/server/auth/ip";
import { getCurrentUser } from "@/server/auth/session";
import { loadAudienceSubject } from "@/server/authz/audience";
import { db } from "@/server/db";
import { downloadUrl } from "@/server/documents/documents";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Download de documento (RN-DOC-005/007): checa sessão, vigência e audiência; audita; e só então
 * redireciona para a URL pré-assinada de 60 s. Qualquer recusa responde 404 (não revela existência).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.nextUrl), { headers: NO_STORE });
  const { id } = await params;
  const notFound = () => new NextResponse("Documento não encontrado.", { status: 404, headers: NO_STORE });
  if (!UUID.test(id)) return notFound();
  const subject = await loadAudienceSubject(db(), user.id);
  if (!subject) return notFound();
  try {
    const url = await downloadUrl(db(), subject, id, clientIp(req.headers));
    return NextResponse.redirect(url, { status: 302, headers: NO_STORE });
  } catch (e) {
    if (e instanceof BusinessError && e.code === "ERR_NOT_FOUND") return notFound();
    if (e instanceof BusinessError && e.code === "ERR_STORAGE_UNAVAILABLE") return new NextResponse("Armazenamento indisponível.", { status: 503, headers: NO_STORE });
    throw e;
  }
}
