import type { Metadata } from "next";
import { PublicationDetail } from "@/components/publications/PublicationDetail";
import { requireUser } from "@/server/auth/session";
import { loadDetailPage } from "@/server/publications/pages";

export const metadata: Metadata = { title: "Comunicado" };
export const dynamic = "force-dynamic";

export default async function AnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const now = new Date();
  const item = await loadDetailPage(user, "ANNOUNCEMENT", (await params).id, now);
  return <PublicationDetail item={item} backHref="/comunicados" backLabel="Todos os comunicados" now={now} />;
}
