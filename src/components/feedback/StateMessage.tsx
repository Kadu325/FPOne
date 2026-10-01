import Link from "next/link";
import type { ReactNode } from "react";

/** Estados obrigatórios de tela (CLAUDE.md): vazio, erro e sem permissão. */
export function StateMessage({ title, children, action }: { title: string; children?: ReactNode; action?: { href: string; label: string } }) {
  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-2xl border border-line bg-white px-6 py-12 text-center shadow-card">
      <h2 className="text-xl font-bold text-brand-ink">{title}</h2>
      {children ? <div className="text-sm text-slate-600">{children}</div> : null}
      {action ? (
        <Link href={action.href} className="font-semibold text-brand-emerald underline underline-offset-4">
          {action.label}
        </Link>
      ) : null}
    </section>
  );
}

export function Unauthorized() {
  return (
    <StateMessage title="Acesso não permitido" action={{ href: "/", label: "Voltar ao início" }}>
      Seu perfil não tem permissão para acessar esta área. Se precisar, fale com um administrador.
    </StateMessage>
  );
}
