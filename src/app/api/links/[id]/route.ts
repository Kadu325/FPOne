import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/server/auth/session";
import { loadAudienceSubject } from "@/server/authz/audience";
import { db } from "@/server/db";
import { openLink } from "@/server/links/links";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { "Cache-Control": "no-store" };

/** Abre um link útil (§162): confere público e status, conta o clique (§43, sem usuário) e redireciona. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.nextUrl), { headers: NO_STORE });
  const { id } = await params;
  const subject = UUID.test(id) ? await loadAudienceSubject(db(), user.id) : null;
  const url = subject ? await openLink(db(), subject, id) : null;
  if (!url) return new NextResponse("Link não encontrado.", { status: 404, headers: NO_STORE });
  return NextResponse.redirect(new URL(url, req.nextUrl), { status: 302, headers: NO_STORE });
}
