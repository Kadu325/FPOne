import type { Metadata } from "next";
import Link from "next/link";
import { PublicationList } from "@/components/publications/PublicationList";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";
import { listCategories } from "@/server/publications/admin";
import { loadFeedPage } from "@/server/publications/pages";

export const metadata: Metadata = { title: "Novidades" };
export const dynamic = "force-dynamic";

/** Novidades (§183) com filtro por categoria (Todas / Empresa / Sistemas / Pessoas…). */
export default async function NewsPage({ searchParams }: { searchParams: Promise<{ categoria?: string }> }) {
  const user = await requireUser();
  const now = new Date();
  const categories = (await listCategories(db())).filter((c) => c.type === "NEWS");
  const { categoria } = await searchParams;
  const active = categories.find((c) => c.id === categoria);
  const items = await loadFeedPage(user, "NEWS", now, active?.id);
  const pill = (selected: boolean) =>
    `rounded-xl px-3.5 py-2 text-xs font-extrabold transition ${selected ? "bg-brand-ink text-white" : "border border-slate-200 bg-white text-slate-700 hover:border-brand-teal/40"}`;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <header>
        <p className="text-xs font-extrabold uppercase tracking-[.16em] text-brand-emerald">O que há de novo</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-ink">Novidades</h1>
        <p className="mt-2 text-sm font-medium text-slate-600">Lançamentos, melhorias e conquistas da empresa.</p>
      </header>
      <nav aria-label="Filtrar novidades" className="flex flex-wrap gap-2">
        <Link href="/novidades" aria-current={!active ? "page" : undefined} className={pill(!active)}>
          Todas
        </Link>
        {categories.map((c) => (
          <Link key={c.id} href={`/novidades?categoria=${c.id}`} aria-current={active?.id === c.id ? "page" : undefined} className={pill(active?.id === c.id)}>
            {c.name}
          </Link>
        ))}
      </nav>
      <PublicationList items={items} basePath="/novidades" now={now} emptyText="Nenhuma novidade publicada ainda." />
    </div>
  );
}
