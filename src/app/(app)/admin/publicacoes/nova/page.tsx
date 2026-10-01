import type { Metadata } from "next";
import Link from "next/link";
import { Unauthorized } from "@/components/feedback/StateMessage";
import { PublicationForm } from "@/components/publications/admin/PublicationForm";
import { ADMIN_NAME } from "@/lib/constants";
import { EMPTY_DOC } from "@/modules/publications/content";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/can";
import { db } from "@/server/db";
import { audienceOptions, listCategories } from "@/server/publications/admin";

export const metadata: Metadata = { title: "Nova publicação" };
export const dynamic = "force-dynamic";

export default async function NewPublicationPage() {
  const user = await requireUser();
  if (!can(user, "publication.create")) {
    return (
      <div className="px-4 py-16">
        <Unauthorized />
      </div>
    );
  }
  const [categories, options] = await Promise.all([listCategories(db()), audienceOptions(db(), user)]);
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <Link href="/admin/publicacoes" className="text-sm font-bold text-brand-emerald hover:underline">
          {ADMIN_NAME} › Publicações
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-ink">Nova publicação</h1>
      </header>
      <PublicationForm
        existing={null}
        initial={{
          type: "ANNOUNCEMENT",
          title: "",
          summary: "",
          content: EMPTY_DOC,
          categoryId: null,
          isFeatured: false,
          pinned: false,
          requiresAcknowledgement: false,
          audiences: [{ audienceType: "ALL", audienceId: null }],
          publishAt: "",
          expiresAt: "",
        }}
        categories={categories}
        units={options.units}
        departments={options.departments}
        perms={{ canEdit: true, canPublish: can(user, "publication.publish"), canArchive: can(user, "publication.archive") }}
      />
    </div>
  );
}
