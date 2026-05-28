import Link from "next/link";

import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata = {
  title: "Zapomenuté heslo — Zozio",
};

export default function ForgotPasswordPage() {
  return (
    <div className="rounded-3xl bg-cream p-8 shadow-soft-md ring-1 ring-ink-900/8 md:p-10">
      <div className="mb-8 space-y-2">
        <h1 className="font-display text-4xl font-bold tracking-tight text-ink-900">
          Zapomenuté heslo
        </h1>
        <p className="text-ink-600">
          Zadej svůj e-mail a pošleme ti odkaz pro nastavení nového hesla.
        </p>
      </div>

      <ForgotPasswordForm />

      <div className="mt-8 border-t border-ink-900/8 pt-6 text-center text-sm text-ink-600">
        Vzpomněl sis?{" "}
        <Link
          href="/auth/login"
          className="font-semibold text-meadow-700 hover:text-meadow-600"
        >
          Zpět na přihlášení
        </Link>
      </div>
    </div>
  );
}
