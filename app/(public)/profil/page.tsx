import Link from "next/link";
import { redirect } from "next/navigation";
import { Heart, LogOut, Search } from "lucide-react";

import { ZozioButton } from "@/components/zozio/button";
import { getUser } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { APPLICATION_STATUS_LABEL, APPLICATION_STATUS_PILL } from "@/lib/format";
import type { ApplicationStatus } from "@/types/database";

export const metadata = {
  title: "Můj profil — Zozio",
};

interface MyApplication {
  id: string;
  status: ApplicationStatus;
  created_at: string;
  animal: { id: string; name: string; primary_photo_url: string | null } | null;
  institution: { name: string } | null;
}

export default async function ProfilePage() {
  const user = await getUser();
  if (!user) redirect("/auth/login?next=/profil");

  const name =
    (user.user_metadata?.full_name as string | undefined) ??
    user.email?.split("@")[0] ??
    "kamaráde";

  // Vlastní žádosti (server-side přes service, filtrované na uživatele).
  const service = createServiceClient();
  const { data: appRows } = await service
    .from("applications")
    .select(
      "id, status, created_at, animal:animals(id, name, primary_photo_url), institution:institutions(name)",
    )
    .eq("applicant_user_id", user.id)
    .order("created_at", { ascending: false });
  const applications = (appRows ?? []) as unknown as MyApplication[];

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

      {/* Moje žádosti */}
      <section className="mt-10">
        <h2 className="font-display text-2xl font-bold tracking-tight text-ink-900">Moje žádosti</h2>
        {applications.length === 0 ? (
          <p className="mt-2 text-ink-600">
            Zatím jsi nepodal(a) žádnou žádost. Až nějakou pošleš, uvidíš tu její stav.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {applications.map((app) => (
              <li
                key={app.id}
                className="flex items-center gap-4 rounded-3xl bg-cream p-4 ring-1 ring-ink-900/8"
              >
                <Link
                  href={app.animal ? `/animals/${app.animal.id}` : "/adopt"}
                  className="flex min-w-0 flex-1 items-center gap-4"
                >
                  <span className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-cream-warm text-2xl">
                    {app.animal?.primary_photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={app.animal.primary_photo_url} alt="" className="size-full object-cover" />
                    ) : (
                      "🐾"
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-lg font-bold text-ink-900">
                      {app.animal?.name ?? "Zvíře"}
                    </span>
                    <span className="block text-sm text-ink-500">
                      {[app.institution?.name, new Date(app.created_at).toLocaleDateString("cs-CZ")]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                </Link>
                <span
                  className={`shrink-0 rounded-pill px-3 py-1 text-xs font-bold ${APPLICATION_STATUS_PILL[app.status] ?? "bg-cream-warm text-ink-600"}`}
                >
                  {APPLICATION_STATUS_LABEL[app.status] ?? app.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form action="/auth/logout" method="post" className="mt-10">
        <ZozioButton type="submit" variant="outline" size="md">
          <LogOut /> Odhlásit se
        </ZozioButton>
      </form>
    </div>
  );
}
