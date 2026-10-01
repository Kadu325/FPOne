"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-4 text-center" role="alert">
      <h1 className="text-2xl font-bold text-brand-ink">Algo deu errado</h1>
      <p className="text-slate-600">Não foi possível carregar esta página. Tente novamente em instantes.</p>
      <button
        type="button"
        onClick={reset}
        className="rounded-xl bg-brand-emerald px-4 py-2 font-semibold text-white hover:bg-brand-ink"
      >
        Tentar novamente
      </button>
    </main>
  );
}
