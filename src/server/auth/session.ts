import "server-only";
import { redirect } from "next/navigation";
import type { Actor } from "@/server/authz/can";
import { auth } from "@/auth";

export interface CurrentUser extends Actor {
  name: string;
  matricula: string;
}

/** Usuário da sessão, já revalidado no banco (status e session_version). */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return { id: session.user.id, name: session.user.name, matricula: session.user.matricula, roles: session.user.roles };
}

/** Para páginas: sem sessão, vai para o login (RN-AUTH-001). */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
