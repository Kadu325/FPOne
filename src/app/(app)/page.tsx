import type { Metadata } from "next";
import { Announcements } from "@/components/home/Announcements";
import { BannerCarousel } from "@/components/home/BannerCarousel";
import { NewsList, RecentDocuments, SmartSearchTeaser } from "@/components/home/ContentBlocks";
import { HomeHero } from "@/components/home/HomeHero";
import { Birthdays, TodayAgenda } from "@/components/home/SidePanels";
import { UsefulLinks } from "@/components/home/UsefulLinks";
import { DemoBadge } from "@/components/feedback/DemoBadge";
import { HOME_NAME } from "@/lib/constants";
import { isDemoMode } from "@/lib/flags";
import { buildMeuDia } from "@/modules/home/meu-dia";
import { getHomeData } from "@/modules/home/service";
import { greeting, longDate } from "@/modules/home/time";
import { requireUser } from "@/server/auth/session";
import { db } from "@/server/db";

export const metadata: Metadata = { title: HOME_NAME };
export const dynamic = "force-dynamic";

/** Meu FPOne, Home 1.3 (§111, §152, §185). Hierarquia: o que precisa de mim hoje primeiro. */
export default async function HomePage() {
  const user = await requireUser();
  const demo = isDemoMode();
  const now = new Date();
  const data = await getHomeData({ demo, now, prisma: db(), userId: user.id });
  const firstName = user.name.split(" ")[0] ?? user.name;

  return (
    <div className="mx-auto max-w-[1480px] space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      {demo ? (
        <div className="flex justify-end">
          <DemoBadge />
        </div>
      ) : null}

      <HomeHero greeting={greeting(now)} firstName={firstName} dateLabel={longDate(now)} items={buildMeuDia(data, now)} linkable={!demo} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Announcements items={data.announcements} now={now} linkable={!demo} />
        <aside aria-label="Resumo do dia" className="space-y-6">
          <TodayAgenda events={data.eventsToday} linkable={!demo} />
          <Birthdays people={data.birthdays} now={now} />
        </aside>
      </div>

      <UsefulLinks links={data.links} />
      <BannerCarousel banners={data.banners} />
      <NewsList items={data.news} now={now} linkable={!demo} />

      <div className="grid gap-6 lg:grid-cols-2">
        <RecentDocuments items={data.documents} now={now} linkable={!demo} />
        <SmartSearchTeaser />
      </div>
    </div>
  );
}
