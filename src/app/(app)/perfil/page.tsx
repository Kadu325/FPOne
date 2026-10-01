import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { ownEmployeeId } from "@/server/people/directory";

export const dynamic = "force-dynamic";

/** Meu Perfil: o mesmo Perfil Corporativo, aberto no próprio colaborador (§106). */
export default async function MyProfilePage() {
  const user = await requireUser();
  const id = await ownEmployeeId(db(), user.id);
  if (!id) notFound();
  redirect(`/pessoas/${id}`);
}
