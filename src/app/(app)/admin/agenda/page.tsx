import type { Metadata } from "next";
import Link from "next/link";
import { Unauthorized } from "@/components/feedback/StateMessage";
import { EventAdmin } from "@/components/events/EventAdmin";
import { ADMIN_NAME } from "@/lib/constants";
import { formatEventRange } from "@/modules/events/format";
import { toLocalInput } from "@/modules/publications/schema";
import { requireUser } from "@/server/auth/session";
import { can } from "@/server/authz/can";
import { db } from "@/server/db";
import { listEventsForAdmin } from "@/server/events/admin";
import { directoryFilters } from "@/server/people/directory";

export const metadata: Metadata = { title: "Agenda" };
export const dynamic = "force-dynamic";

export default async function EventsAdminPage() {
  const user = await requireUser();
  if (!can(user, "event.manage")) {
    return (
      <div className="px-4 py-16">
        <Unauthorized />
      </div>
    );
  }
  const now = new Date();
  const [events, filters] = await Promise.all([listEventsForAdmin(db(), user, now), directoryFilters(db())]);
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
      <header>
        <Link href="/admin" className="text-sm font-bold text-brand-emerald hover:underline">
          {ADMIN_NAME}
        </Link>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-brand-ink">Agenda</h1>
      </header>
      <EventAdmin
        events={events.map((e) => ({
          id: e.id,
          title: e.title,
          description: e.description,
          location: e.location,
          startLocal: toLocalInput(e.startAt),
          endLocal: toLocalInput(e.endAt),
          when: formatEventRange(e.startAt, e.endAt),
          status: e.status,
          audiences: e.audiences,
        }))}
        units={filters.units}
        departments={filters.departments}
      />
    </div>
  );
}
