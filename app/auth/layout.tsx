import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-cream-warm">
      <header className="border-b border-ink-900/8 bg-cream">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="font-display text-3xl font-bold tracking-tight text-ink-900"
          >
            zozio
            <span className="text-meadow-500">.</span>
          </Link>
          <Link
            href="/"
            className="text-sm font-medium text-ink-600 hover:text-ink-900"
          >
            ← Zpět na hlavní stránku
          </Link>
        </div>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
