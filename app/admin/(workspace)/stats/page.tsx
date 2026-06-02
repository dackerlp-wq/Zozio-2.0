import { redirect } from "next/navigation";

import { requireMembership } from "@/lib/auth";

export const metadata = { title: "Statistiky — Zozio Admin" };

export default async function StatsPage() {
  const { role } = await requireMembership();
  if (role === "staff") redirect("/admin/dashboard");
  return (
    <div className="mx-auto max-w-3xl">
      <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
        Statistiky
      </h2>
      <p className="mt-1 text-ink-600">
        Adopce, délka pobytu, obsazenost kotců a náklady v čase.
      </p>
      <div className="mt-6 rounded-3xl bg-cream p-10 text-center ring-1 ring-ink-900/8">
        <div className="text-4xl">📈</div>
        <p className="mt-3 font-display text-lg font-bold text-ink-900">Připravujeme</p>
        <p className="mt-1 text-sm text-ink-500">
          Přehledové grafy nad daty z evidence, zdraví a adopcí.
        </p>
      </div>
    </div>
  );
}
