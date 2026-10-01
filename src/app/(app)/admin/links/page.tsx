import type { Metadata } from "next";
import Link from "next/link";
import { Unauthorized } from "@/components/feedback/StateMessage";
import { LinkAdmin } from "@/components/links/LinkAdmin";
import { ADMIN_NAME } from "@/lib/constants";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/can";
import { db } from "@/server/db";
import { listLinksForAdmin } from "@/server/links/admin";
import { directoryFilters } from "@/server/people/directory";

export const metadata: Metadata = { title: "Links úteis" };
export const dynamic = "force-dynamic";

export default async function LinksAdminPage() {
  const user = await requireUser();
  if (!can(user, "link.manage")) {
    return (
      <div className="px-4 py-16">
        <Unauthorized />
      </div>
    );
  }
  const [links, filters] = await Promise.all([listLinksForAdmin(db(), user), directoryFilters(db())]);
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <Link href="/admin" className="text-sm font-bold text-brand-emerald hover:underline">
          {ADMIN_NAME}
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-ink">Links úteis</h1>
        <p className="mt-1 text-sm text-slate-600">Atalhos para Sankhya, FP Nexus, Chamados e outros sistemas. Aparecem na Home e em Links úteis, na ordem abaixo.</p>
      </header>
      <LinkAdmin links={links} units={filters.units} departments={filters.departments} />
    </div>
  );
}
