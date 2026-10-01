"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { HomeBanner } from "@/modules/home/types";

const BACKGROUNDS = ["bg-gradient-to-br from-brand-emerald via-brand-emerald to-brand-blue", "bg-brand-ink"];

/** Banner único com navegação manual, sem autoplay (§185, WCAG 2.2.2). Até 3 banners (RN-HOME-005). */
export function BannerCarousel({ banners }: { banners: HomeBanner[] }) {
  const [index, setIndex] = useState(0);
  if (banners.length === 0) return null;
  const total = banners.length;
  const current = banners[Math.min(index, total - 1)];
  if (!current) return null;
  const go = (delta: number) => setIndex((i) => (i + delta + total) % total);

  return (
    <section aria-roledescription="carrossel" aria-label="Campanhas internas" className="relative">
      <article
        role="group"
        aria-roledescription="slide"
        aria-label={`${index + 1} de ${total}`}
        className={`relative min-h-[210px] overflow-hidden rounded-[28px] p-6 pb-16 text-white shadow-card sm:p-8 sm:pb-16 ${BACKGROUNDS[index % BACKGROUNDS.length]}`}
      >
        <span className="inline-flex rounded-lg bg-white/15 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[.12em]">{current.eyebrow}</span>
        <h2 className="mt-4 max-w-2xl text-2xl font-extrabold leading-tight sm:text-3xl">{current.title}</h2>
        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-white">{current.body}</p>
        {current.note ? <p className="mt-4 text-xs font-bold text-white">{current.note}</p> : null}
      </article>
      {total > 1 ? (
        <div className="absolute bottom-5 right-5 flex items-center gap-2">
          <button type="button" onClick={() => go(-1)} aria-label="Banner anterior" className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 text-white hover:bg-white/25">
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <span aria-live="polite" className="min-w-[36px] text-center text-xs font-extrabold text-white">
            {index + 1}/{total}
          </span>
          <button type="button" onClick={() => go(1)} aria-label="Próximo banner" className="grid h-9 w-9 place-items-center rounded-xl bg-white/15 text-white hover:bg-white/25">
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </section>
  );
}
