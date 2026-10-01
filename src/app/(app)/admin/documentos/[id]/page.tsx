import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentEditor } from "@/components/documents/DocumentEditor";
import { Unauthorized } from "@/components/feedback/StateMessage";
import { ADMIN_NAME } from "@/lib/constants";
import { BusinessError } from "@/lib/errors";
import { formatBytes, formatDateTime, toDateInput } from "@/modules/documents/format";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/can";
import { db } from "@/server/db";
import { getDocumentForAdmin, type AdminDocument } from "@/server/documents/admin";
import { directoryFilters } from "@/server/people/directory";

export const metadata: Metadata = { title: "Editar documento" };
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  if (!can(user, "document.manage")) {
    return (
      <div className="px-4 py-16">
        <Unauthorized />
      </div>
    );
  }
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  let d: AdminDocument;
  try {
    d = await getDocumentForAdmin(db(), user, id);
  } catch (e) {
    if (e instanceof BusinessError && e.code === "ERR_NOT_FOUND") notFound();
    throw e;
  }
  const filters = await directoryFilters(db());
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <Link href="/admin/documentos" className="text-sm font-bold text-brand-emerald hover:underline">
          {ADMIN_NAME} › Documentos
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-ink">{d.title}</h1>
      </header>
      <DocumentEditor
        existing={{ id: d.id, status: d.status, currentVersion: d.currentVersion, owner: d.owner }}
        initial={{ title: d.title, description: d.description, category: d.category, effectiveAt: toDateInput(d.effectiveAt), reviewAt: toDateInput(d.reviewAt), audiences: d.audiences }}
        versions={d.versions.map((v) => ({ version: v.version, fileName: v.fileName, size: formatBytes(v.sizeBytes), status: v.status, when: formatDateTime(v.createdAt), uploadedBy: v.uploadedBy }))}
        units={filters.units}
        departments={filters.departments}
      />
    </div>
  );
}
