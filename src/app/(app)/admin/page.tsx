import type { Metadata } from "next";
import Link from "next/link";
import { Unauthorized } from "@/components/feedback/StateMessage";
import { NavIcon } from "@/components/layout/NavIcon";
import { ADMIN_NAME } from "@/lib/constants";
import { ADMIN_NAVIGATION } from "@/modules/navigation/nav";
import { can } from "@/server/authz/can";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: ADMIN_NAME };
export const dynamic = "force-dynamic";

/** Entrada do FPOne Admin (§91, §116). Lista só as áreas já entregues e permitidas. */
export default async function AdminHomePage() {
  const user = await requireUser();
  if (!can(user, "admin.access")) {
    return (
      <div className="px-4 py-16">
        <Unauthorized />
      </div>
    );
  }
  const areas = ADMIN_NAVIGATION.filter((i) => i.ready && (i.permission === null || can(user, i.permission)));
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-brand-ink">{ADMIN_NAME}</h1>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {areas.map((a) => (
          <li key={a.id}>
            <Link href={a.href} className="flex items-center gap-3 rounded-2xl border border-line bg-white p-5 font-bold text-brand-ink shadow-card hover:border-brand-teal/40">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-brand-emerald">
                <NavIcon name={a.icon} />
              </span>
              {a.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
