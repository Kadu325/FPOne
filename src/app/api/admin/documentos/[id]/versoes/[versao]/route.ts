import { NextResponse, type NextRequest } from "next/server";
import { BusinessError } from "@/lib/errors";
import { clientIp } from "@/server/auth/ip";
import { getCurrentUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { adminDownloadUrl } from "@/server/documents/admin";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { "Cache-Control": "no-store" };

/** Download de qualquer versão pela gestão (document.manage), auditado. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; versao: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.nextUrl), { headers: NO_STORE });
  const { id, versao } = await params;
  const version = Number(versao);
  if (!UUID.test(id) || !Number.isInteger(version) || version < 1) return new NextResponse("Não encontrado.", { status: 404, headers: NO_STORE });
  try {
    const url = await adminDownloadUrl(db(), user, id, version, clientIp(req.headers));
    return NextResponse.redirect(url, { status: 302, headers: NO_STORE });
  } catch (e) {
    if (e instanceof BusinessError && (e.code === "ERR_NOT_FOUND" || e.code === "ERR_FORBIDDEN")) return new NextResponse("Não encontrado.", { status: 404, headers: NO_STORE });
    if (e instanceof BusinessError && e.code === "ERR_STORAGE_UNAVAILABLE") return new NextResponse("Armazenamento indisponível.", { status: 503, headers: NO_STORE });
    throw e;
  }
}
