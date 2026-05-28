import Link from "next/link";
import { Plus, PawPrint, Inbox, Eye, AlertTriangle } from "lucide-react";

import { ZozioButton } from "@/components/zozio/button";
import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Přehled — Zozio Admin" };

export default async function DashboardPage() {
  const { institutionId, institution } = await requireMembership();
  const supabase = await createClient();

  const [animalsTotal, animalsAvailable, applicationsNew] = await Promise.all([
    supabase
      .from("animals")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", institutionId),
    supabase
      .from("animals")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", institutionId)
      .eq("adoption_status", "available"),
    supabase
      .from("applications")
      .select("*", { count: "exact", head: true })
      .eq("institution_id", institutionId)
      .eq("status", "new"),
  ]);

  const stats = [
    {
      label: "Zvířat celkem",
      value: animalsTotal.count ?? 0,
      icon: PawPrint,
      href: "/admin/animals",
    },
    {
      label: "Zveřejněno",
      value: animalsAvailable.count ?? 0,
      icon: Eye,
      href: "/admin/animals?status=available",
    },
    {
      label: "Nové žádosti",
      value: applicationsNew.count ?? 0,
      icon: Inbox,
      href: "/admin/applications",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Heading */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
            Vítej zpátky 👋
          </h2>
          <p className="mt-1 text-ink-600">
            Přehled tvého útulku {institution.name}.
          </p>
        </div>
        <ZozioButton asChild variant="meadow" size="md">
          <Link href="/admin/animals/new">
            <Plus /> Přidat zvíře
          </Link>
        </ZozioButton>
      </div>

      {/* Not published warning */}
      {!institution.is_published && (
        <div className="flex items-start gap-3 rounded-3xl bg-sunshine-200 p-5 text-sm text-sunshine-600 ring-1 ring-inset ring-sunshine-400/40">
          <AlertTriangle className="size-5 shrink-0" />
          <div>
            <p className="font-semibold text-ink-900">
              Útulek zatím není zveřejněný
            </p>
            <p className="mt-0.5 text-ink-700">
              Přidej alespoň jedno zvíře a zveřejni útulek v nastavení, aby tě
              adoptanti našli na zozio.cz.
            </p>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className="group rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8 transition hover:-translate-y-0.5 hover:shadow-soft-md"
            >
              <div className="flex items-center justify-between">
                <span className="inline-flex size-10 items-center justify-center rounded-2xl bg-sage-100 text-sage-700">
                  <Icon className="size-5" />
                </span>
              </div>
              <div className="mt-4 font-display text-4xl font-bold tracking-tight text-ink-900">
                {s.value}
              </div>
              <div className="mt-1 text-sm font-semibold text-ink-600">
                {s.label}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
        <h3 className="font-display text-xl font-bold text-ink-900">
          Rychlé akce
        </h3>
        <div className="mt-4 flex flex-wrap gap-3">
          <ZozioButton asChild variant="outline" size="md">
            <Link href="/admin/animals/new">Přidat zvíře</Link>
          </ZozioButton>
          <ZozioButton asChild variant="outline" size="md">
            <Link href="/admin/animals">Spravovat zvířata</Link>
          </ZozioButton>
          <ZozioButton asChild variant="outline" size="md">
            <Link href="/admin/settings">Upravit profil útulku</Link>
          </ZozioButton>
        </div>
      </div>
    </div>
  );
}
