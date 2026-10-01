import type { Metadata } from "next";
import { PublicationDetail } from "@/components/publications/PublicationDetail";
import { requireUser } from "@/server/auth/session";
import { loadDetailPage } from "@/server/publications/pages";

export const metadata: Metadata = { title: "Novidade" };
export const dynamic = "force-dynamic";

export default async function NewsItemPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const now = new Date();
  const item = await loadDetailPage(user, "NEWS", (await params).id, now);
  return <PublicationDetail item={item} backHref="/novidades" backLabel="Todas as novidades" now={now} />;
}
