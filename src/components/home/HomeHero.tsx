import Link from "next/link";
import { CalendarClock, CircleAlert, FilePlus } from "lucide-react";
import { timeOfDay } from "@/modules/home/time";
import type { MeuDiaItem } from "@/modules/home/types";

const CARD = "flex h-full flex-col rounded-2xl border border-brand-lime/30 bg-white/10 p-4";

/**
 * Hero compacto (§185): saudação, data e Meu Dia com até 3 itens. Meu Dia aparece só aqui.
 * Ciência pendente leva ao comunicado; evento, à agenda; documentos novos, à biblioteca.
 */
export function HomeHero({ greeting, firstName, dateLabel, items, linkable }: { greeting: string; firstName: string; dateLabel: string; items: MeuDiaItem[]; linkable: boolean }) {
  const summary =
    items.length === 0 ? (
      "Nada pendente para hoje."
    ) : (
      <>
        Você tem <strong className="font-extrabold text-white">{items.length === 1 ? "1 item" : `${items.length} itens`}</strong> para hoje.
        {items[0]?.kind === "acknowledgement" ? " Comece pelo comunicado que pede sua ciência." : null}
      </>
    );

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden rounded-[32px] bg-brand-ink shadow-soft">
      <div aria-hidden="true" className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-lime/20 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-40 right-8 h-[420px] w-[420px] rounded-full bg-brand-cyan/25 blur-3xl" />
      <div className="relative flex flex-col gap-7 p-6 sm:p-8 xl:flex-row xl:items-center xl:justify-between xl:p-10">
        <div className="max-w-xl">
          <p className="text-sm font-bold text-white/90">{dateLabel}</p>
          <h1 id="hero-title" className="mt-2 text-3xl font-extrabold leading-tight tracking-[-.03em] text-white sm:text-4xl">
            {greeting}, {firstName}.
          </h1>
          <p className="mt-3 text-sm font-medium leading-6 text-white/90 sm:text-base">{summary}</p>
        </div>
        {items.length > 0 ? (
          <ul aria-label="Meu dia" className="grid gap-3 sm:grid-cols-3 xl:w-[660px]">
            {items.map((item) => (
              <li key={item.kind === "documents" ? "documents" : item.id}>
                {linkable ? (
                  <Link href={item.kind === "acknowledgement" ? `/comunicados/${item.id}` : item.kind === "event" ? "/agenda" : "/documentos"} className={`${CARD} transition hover:bg-white/15`}>
                    <MeuDiaContent item={item} />
                  </Link>
                ) : (
                  <div className={CARD}>
                    <MeuDiaContent item={item} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

function MeuDiaContent({ item }: { item: MeuDiaItem }) {
  const label = "flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.1em] text-white [&_svg]:text-brand-lime";
  const title = "mt-2 text-sm font-extrabold leading-5 text-white";
  const note = "mt-auto pt-3 text-xs font-bold text-white/90";
  switch (item.kind) {
    case "acknowledgement":
      return (
        <>
          <span className={label}>
            <CircleAlert className="h-4 w-4" aria-hidden="true" />
            Ciência pendente
          </span>
          <span className={title}>{item.title}</span>
          <span className={note}>Confirmar leitura</span>
        </>
      );
    case "event":
      return (
        <>
          <span className={label}>
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            Hoje, {timeOfDay(item.startsAt)}
          </span>
          <span className={title}>{item.title}</span>
          <span className={note}>{item.location}</span>
        </>
      );
    case "documents":
      return (
        <>
          <span className={label}>
            <FilePlus className="h-4 w-4" aria-hidden="true" />
            {item.count === 1 ? "1 documento novo" : `${item.count} documentos novos`}
          </span>
          <span className={title}>{item.titles.join(" e ")}</span>
          <span className={note}>Documentos</span>
        </>
      );
  }
}
