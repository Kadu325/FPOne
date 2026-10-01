import type { Metadata } from "next";
import Link from "next/link";
import { Unauthorized } from "@/components/feedback/StateMessage";
import { CategoryForm } from "@/components/publications/admin/CategoryForm";
import { ADMIN_NAME } from "@/lib/constants";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/can";
import { db } from "@/server/db";
import { listCategories } from "@/server/publications/admin";

export const metadata: Metadata = { title: "Categorias" };
export const dynamic = "force-dynamic";

/** Categorias de Comunicados e Novidades (§183: Empresa, Sistemas, Pessoas iniciais). */
export default async function CategoriesPage() {
  const user = await requireUser();
  if (!can(user, "category.manage")) {
    return (
      <div className="px-4 py-16">
        <Unauthorized />
      </div>
    );
  }
  const categories = await listCategories(db());
  const groups = [
    { type: "ANNOUNCEMENT", title: "Comunicados" },
    { type: "NEWS", title: "Novidades" },
  ] as const;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <Link href="/admin/publicacoes" className="text-sm font-bold text-brand-emerald hover:underline">
          {ADMIN_NAME} › Publicações
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-ink">Categorias</h1>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {groups.map((g) => {
          const list = categories.filter((c) => c.type === g.type);
          return (
            <section key={g.type} aria-labelledby={`cat-${g.type}`} className="rounded-3xl border border-line bg-white p-5 shadow-card">
              <h2 id={`cat-${g.type}`} className="text-lg font-extrabold text-brand-ink">
                {g.title}
              </h2>
              {list.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600">Nenhuma categoria.</p>
              ) : (
                <ul className="mt-3 space-y-1 text-sm font-semibold text-slate-800">
                  {list.map((c) => (
                    <li key={c.id}>{c.name}</li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
      <CategoryForm />
    </div>
  );
}
