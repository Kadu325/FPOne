import type { Metadata } from "next";
import { PublicationList } from "@/components/publications/PublicationList";
import { requireUser } from "@/server/auth/session";
import { loadFeedPage } from "@/server/publications/pages";

export const metadata: Metadata = { title: "Comunicados" };
export const dynamic = "force-dynamic";

/** Comunicados do usuário: fixados e pendentes de ciência primeiro (§78, RN-HOME-002). */
export default async function AnnouncementsPage() {
  const user = await requireUser();
  const now = new Date();
  const items = await loadFeedPage(user, "ANNOUNCEMENT", now);
  const sorted = [...items].sort((a, b) => Number(b.pendingAcknowledgement) - Number(a.pendingAcknowledgement));
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs font-extrabold uppercase tracking-[.16em] text-brand-emerald">Comunicação</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-ink">Comunicados</h1>
        <p className="mt-2 text-sm font-medium text-slate-600">Comunicados oficiais para você. Os que pedem ciência aparecem primeiro.</p>
      </header>
      <PublicationList items={sorted} basePath="/comunicados" now={now} emptyText="Nenhum comunicado para você no momento." />
    </div>
  );
}
