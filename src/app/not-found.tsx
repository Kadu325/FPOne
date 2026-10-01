import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-bold text-brand-ink">Página não encontrada</h1>
      <p className="text-slate-600">O endereço acessado não existe ou foi movido.</p>
      <Link href="/" className="font-semibold text-brand-emerald underline underline-offset-4">
        Voltar ao início
      </Link>
    </main>
  );
}
