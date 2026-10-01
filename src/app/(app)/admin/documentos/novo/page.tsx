import type { Metadata } from "next";
import Link from "next/link";
import { DocumentEditor } from "@/components/documents/DocumentEditor";
import { Unauthorized } from "@/components/feedback/StateMessage";
import { ADMIN_NAME } from "@/lib/constants";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/can";
import { db } from "@/server/db";
import { directoryFilters } from "@/server/people/directory";

export const metadata: Metadata = { title: "Novo documento" };
export const dynamic = "force-dynamic";

export default async function NewDocumentPage() {
  const user = await requireUser();
  if (!can(user, "document.manage")) {
    return (
      <div className="px-4 py-16">
        <Unauthorized />
      </div>
    );
  }
  const filters = await directoryFilters(db());
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <Link href="/admin/documentos" className="text-sm font-bold text-brand-emerald hover:underline">
          {ADMIN_NAME} › Documentos
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-ink">Novo documento</h1>
      </header>
      <DocumentEditor
        existing={null}
        initial={{ title: "", description: "", category: "", effectiveAt: "", reviewAt: "", audiences: [{ audienceType: "ALL", audienceId: null }] }}
        versions={[]}
        units={filters.units}
        departments={filters.departments}
      />
    </div>
  );
}
