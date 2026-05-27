import Link from "next/link";

import { LoginForm } from "../login/login-form";

interface PageProps {
  searchParams: Promise<{ next?: string }>;
}

export const metadata = {
  title: "Registrace — Zozio",
};

export default async function RegisterPage({ searchParams }: PageProps) {
  const { next } = await searchParams;

  return (
    <div className="rounded-3xl bg-cream p-8 shadow-soft-md ring-1 ring-ink-900/8 md:p-10">
      <div className="mb-8 space-y-2">
        <h1 className="font-display text-4xl font-bold tracking-tight text-ink-900">
          Vítej v Zoziu
        </h1>
        <p className="text-ink-600">
          Zaregistruj se a začni hledat svého nového parťáka — nebo začni
          spravovat útulek.
        </p>
      </div>

      <LoginForm next={next} />

      <div className="mt-8 border-t border-ink-900/8 pt-6 text-center text-sm text-ink-600">
        Už máš účet?{" "}
        <Link
          href={`/auth/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
          className="font-semibold text-meadow-700 hover:text-meadow-600"
        >
          Přihlas se
        </Link>
      </div>
    </div>
  );
}
