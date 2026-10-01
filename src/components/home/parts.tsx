import type { ReactNode } from "react";

/** Cabeçalho de bloco da Home: sobretítulo + título (protótipo 1.3). */
export function SectionHeading({ id, eyebrow, title, eyebrowClass = "text-brand-emerald", size = "text-xl", children }: {
  id: string;
  eyebrow: string;
  title: string;
  eyebrowClass?: string;
  size?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className={`text-xs font-extrabold uppercase tracking-[.16em] ${eyebrowClass}`}>{eyebrow}</p>
        <h2 id={id} className={`mt-1 font-extrabold text-brand-ink ${size}`}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  );
}

/** Estado vazio de um bloco (RN-HOME-006): mantém o layout, sem inventar informação. */
export function EmptyWidget({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-600">{children}</p>;
}

export function Card({ children, className = "", ...rest }: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={`rounded-3xl border border-line bg-white p-5 shadow-card sm:p-6 ${className}`} {...rest}>
      {children}
    </section>
  );
}
