import Link from "next/link";

import { getUser } from "@/lib/auth";

import { ResetPasswordForm } from "./reset-password-form";

export const metadata = {
  title: "Nové heslo — Zozio",
};

export default async function ResetPasswordPage() {
  // Po kliknutí na odkaz z e-mailu naváže /auth/callback recovery session.
  const user = await getUser();

  return (
    <div className="rounded-3xl bg-cream p-8 shadow-soft-md ring-1 ring-ink-900/8 md:p-10">
      <div className="mb-8 space-y-2">
        <h1 className="font-display text-4xl font-bold tracking-tight text-ink-900">
          Nové heslo
        </h1>
        <p className="text-ink-600">
          {user
            ? "Zadej své nové heslo."
            : "Odkaz pro obnovu hesla je neplatný nebo vypršel."}
        </p>
      </div>

      {user ? (
        <ResetPasswordForm
          role={(user.user_metadata?.role as string | undefined) ?? null}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-ink-600">
            Vyžádej si prosím nový odkaz pro nastavení hesla.
          </p>
          <Link
            href="/auth/forgot-password"
            className="inline-block font-semibold text-meadow-700 hover:text-meadow-600"
          >
            Zapomenuté heslo →
          </Link>
        </div>
      )}
    </div>
  );
}
