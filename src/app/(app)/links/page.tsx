import type { Metadata } from "next";
import { UsefulLinks } from "@/components/home/UsefulLinks";
import { requireUser } from "@/server/auth/session";
import { loadAudienceSubject } from "@/server/authz/audience";
import { db } from "@/server/db";
import { isInternalLink } from "@/modules/links/url";
import { listLinksForUser } from "@/server/links/links";

export const metadata: Metadata = { title: "Links úteis" };
export const dynamic = "force-dynamic";

/** Links úteis do público do usuário (§162, RN-LNK-001..003). */
export default async function LinksPage() {
  const user = await requireUser();
  const subject = await loadAudienceSubject(db(), user.id);
  const links = subject ? await listLinksForUser(db(), subject) : [];
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs font-extrabold uppercase tracking-[.16em] text-brand-emerald">Organização</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-ink">Links úteis</h1>
      </header>
      <UsefulLinks links={links.map((l) => ({ id: l.id, label: l.label, description: l.description, href: `/api/links/${l.id}`, external: !isInternalLink(l.url) }))} showHeading={false} />
    </div>
  );
}
