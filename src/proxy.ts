import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";

/**
 * RN-AUTH-001: toda rota exige sessão, exceto login, rotas do Auth.js, health e estáticos.
 * É a primeira barreira; páginas e ações também checam no servidor (requireUser / can).
 */
export async function proxy(req: NextRequest) {
  const session = await auth();
  if (session?.user?.id) return NextResponse.next();
  const url = new URL("/login", req.nextUrl);
  if (req.nextUrl.pathname !== "/") url.searchParams.set("callbackUrl", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export default proxy;

export const config = {
  matcher: ["/((?!login|api/auth|api/health|_next/static|_next/image|brand|favicon.ico|robots.txt).*)"],
};
