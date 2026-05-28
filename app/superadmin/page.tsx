import Link from "next/link";
import { Building2, Clock, PawPrint, Users } from "lucide-react";

import { createServiceClient } from "@/lib/supabase/service";

export const metadata = { title: "Přehled — Superadmin" };

export default async function SuperadminDashboardPage() {
  const service = createServiceClient();

  const [institutionsTotal, institutionsPending, animalsTotal, usersList] =
    await Promise.all([
      service
        .from("institutions")
        .select("*", { count: "exact", head: true }),
      service
        .from("institutions")
        .select("*", { count: "exact", head: true })
        .eq("verification_status", "pending"),
      service.from("animals").select("*", { count: "exact", head: true }),
      service.auth.admin.listUsers({ perPage: 1 }),
    ]);

  const usersTotal =
    (usersList.data as { total?: number } | null)?.total ?? 0;

  const stats = [
    {
      label: "Útulků celkem",
      value: institutionsTotal.count ?? 0,
      icon: Building2,
      href: "/superadmin/institutions",
    },
    {
      label: "Čeká na ověření",
      value: institutionsPending.count ?? 0,
      icon: Clock,
      href: "/superadmin/institutions?status=pending",
      highlight: (institutionsPending.count ?? 0) > 0,
    },
    {
      label: "Zvířat celkem",
      value: animalsTotal.count ?? 0,
      icon: PawPrint,
      href: "/superadmin/institutions",
    },
    {
      label: "Uživatelů",
      value: usersTotal,
      icon: Users,
      href: "/superadmin/users",
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">
          Superadmin přehled
        </h1>
        <p className="mt-1 text-ink-600">Správa celé platformy Zozio.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.label}
              href={s.href}
              className="group rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8 transition hover:-translate-y-0.5 hover:shadow-soft-md"
            >
              <span
                className={
                  s.highlight
                    ? "inline-flex size-10 items-center justify-center rounded-2xl bg-sunshine-200 text-sunshine-600"
                    : "inline-flex size-10 items-center justify-center rounded-2xl bg-sage-100 text-sage-700"
                }
              >
                <Icon className="size-5" />
              </span>
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
    </div>
  );
}
