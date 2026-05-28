import { redirect } from "next/navigation";

import { ZozLogo } from "@/components/zozio/logo";
import { getCurrentMembership, getUser } from "@/lib/auth";

import { OnboardingForm } from "./onboarding-form";

export const metadata = {
  title: "Vytvoř svůj útulek — Zozio",
};

export default async function OnboardingPage() {
  const user = await getUser();
  if (!user) redirect("/auth/login?next=/admin/onboarding");

  // Už je členem útulku → rovnou do dashboardu
  const membership = await getCurrentMembership();
  if (membership) redirect("/admin/dashboard");

  return (
    <div className="flex min-h-screen flex-col bg-cream-warm">
      <header className="border-b border-ink-900/8 bg-cream">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <ZozLogo size="sm" />
          <form action="/auth/logout" method="post">
            <button
              type="submit"
              className="text-sm font-medium text-ink-600 hover:text-ink-900"
            >
              Odhlásit
            </button>
          </form>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          <div className="mb-8 space-y-2">
            <div className="font-mono text-xs uppercase tracking-wider text-meadow-700">
              Vítej v Zoziu
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-ink-900 md:text-5xl">
              Pojďme založit tvůj útulek
            </h1>
            <p className="text-lg text-ink-600">
              Pár základních údajů a můžeš začít přidávat zvířata. Vše půjde
              později upravit v nastavení.
            </p>
          </div>

          <OnboardingForm userEmail={user.email ?? ""} />
        </div>
      </main>
    </div>
  );
}
