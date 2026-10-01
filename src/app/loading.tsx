export default function Loading() {
  return (
    <main className="flex min-h-screen items-center justify-center" aria-busy="true">
      <p className="text-slate-600" role="status">
        Carregando…
      </p>
    </main>
  );
}
