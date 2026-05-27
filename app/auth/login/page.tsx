import Link from "next/link";

import { LoginForm } from "./login-form";

interface PageProps {
  searchParams: Promise<{ next?: string; sent?: string; error?: string }>;
}

export const metadata = {
  title: "Přihlášení — Zozio",
};

export default async function LoginPage({ searchParams }: PageProps) {
  const { next, sent, error } = await searchParams;

  return (
    <div className="rounded-3xl bg-cream p-8 shadow-soft-md ring-1 ring-ink-900/8 md:p-10">
      <div className="mb-8 space-y-2">
        <h1 className="font-display text-4xl font-bold tracking-tight text-ink-900">
          Vítej zpátky
        </h1>
        <p className="text-ink-600">
          Přihlas se a pokračuj ve své práci.
        </p>
      </div>

      <LoginForm next={next} initialSent={sent === "1"} initialError={error} />

      <div className="mt-8 border-t border-ink-900/8 pt-6 text-center text-sm text-ink-600">
        Ještě nemáš účet?{" "}
        <Link
          href={`/auth/register${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-semibold text-meadow-700 hover:text-meadow-600"
        >
          Zaregistruj se
        </Link>
      </div>
    </div>
  );
}
