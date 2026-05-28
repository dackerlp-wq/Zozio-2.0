import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart, LogOut, Search } from "lucide-react";

import { ZozioButton } from "@/components/zozio/button";
import { getUser } from "@/lib/auth";

export const metadata = {
  title: "Můj profil — Zozio",
};

export default async function ProfilePage() {
  const user = await getUser();
  if (!user) redirect("/auth/login?next=/profil");

  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "kamaráde";

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="font-mono text-xs uppercase tracking-wider text-meadow-700">
        Můj profil
      </div>
      <h1 className="mt-1 font-display text-4xl font-bold tracking-tight text-ink-900">
        Ahoj, {name}!
      </h1>
      <p className="mt-2 text-ink-600">
        Přihlášen jako <strong>{user.email}</strong>.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/adopt"
          className="group flex items-start gap-4 rounded-3xl bg-cream p-6 shadow-soft-md ring-1 ring-ink-900/8 transition-colors hover:ring-meadow-300"
        >
          <span className="rounded-2xl bg-meadow-100 p-3 text-meadow-700">
            <Search className="size-6" />
          </span>
          <span>
            <span className="block font-display text-lg font-bold text-ink-900">
              Najdi parťáka
            </span>
            <span className="text-sm text-ink-600">
              Procházej zvířata k adopci.
            </span>
          </span>
        </Link>

        <div className="flex items-start gap-4 rounded-3xl bg-cream p-6 shadow-soft-md ring-1 ring-ink-900/8">
          <span className="rounded-2xl bg-peach-100 p-3 text-terracotta-600">
            <Heart className="size-6" />
          </span>
          <span>
            <span className="block font-display text-lg font-bold text-ink-900">
              Oblíbená zvířata
            </span>
            <span className="text-sm text-ink-600">
              Uložená zvířata se brzy objeví tady.
            </span>
          </span>
        </div>
      </div>

      <form action="/auth/logout" method="post" className="mt-10">
        <ZozioButton type="submit" variant="outline" size="md">
          <LogOut /> Odhlásit se
        </ZozioButton>
      </form>
    </div>
  );
}
