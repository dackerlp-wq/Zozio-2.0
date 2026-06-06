import { redirect } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { canView, can } from "@/lib/permissions";
import { createClient } from "@/lib/supabase/server";
import { loadStats, resolvePeriods, type PeriodKind } from "@/lib/stats";

import { StatsView, type StatsSection } from "./stats-view";

export const metadata = { title: "Statistiky — Zozio Admin" };

const SECTIONS: StatsSection[] = ["prehled", "zvirata", "adopce", "pestouni", "obsazenost", "finance", "web"];
const PAID = ["standard", "pro"];

interface PageProps {
  searchParams: Promise<{
    sekce?: string;
    obdobi?: string;
    from?: string;
    to?: string;
    srovnat?: string;
  }>;
}

export default async function StatsPage({ searchParams }: PageProps) {
  const { institutionId, role } = await requireMembership();
  if (!canView(role, "stats")) redirect("/admin/dashboard");

  const sp = await searchParams;
  const section: StatsSection = SECTIONS.includes(sp.sekce as StatsSection)
    ? (sp.sekce as StatsSection)
    : "prehled";

  // Tarif Profi+ (gating).
  const supabase = await createClient();
  const { data: inst } = await supabase
    .from("institutions")
    .select("plan")
    .eq("id", institutionId)
    .maybeSingle();
  const plan = (inst as { plan: string } | null)?.plan ?? "free";
  const isPaid = PAID.includes(plan);

  if (!isPaid) {
    return (
      <div className="mx-auto max-w-2xl">
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">Statistiky</h2>
        <div className="mt-6 rounded-3xl bg-cream p-10 text-center ring-1 ring-ink-900/8">
          <div className="text-4xl">📈</div>
          <p className="mt-3 font-display text-lg font-bold text-ink-900">
            Statistiky jsou v tarifu Profi+
          </p>
          <p className="mt-1 text-sm text-ink-500">
            Detailní grafy adopcí, obsazenosti, financí a zájmu o zvířata.
            Aktivuj v{" "}
            <a href="/admin/settings?sekce=predplatne" className="font-semibold text-meadow-600 hover:underline">
              Předplatném
            </a>.
          </p>
        </div>
      </div>
    );
  }

  const kind: PeriodKind = (["month", "year", "custom"].includes(sp.obdobi ?? "")
    ? sp.obdobi
    : "year") as PeriodKind;
  const { current, previous } = resolvePeriods(kind, sp.from, sp.to);
  const compare = sp.srovnat === "1";

  const data = await loadStats(institutionId, current);
  const prev = compare ? await loadStats(institutionId, previous) : null;

  const canExport = can(role, "stats");

  return (
    <StatsView
      section={section}
      data={data}
      prev={prev}
      periodKind={kind}
      periodLabel={current.label}
      prevLabel={previous.label}
      from={current.from}
      to={current.to}
      compare={compare}
      canExport={canExport}
    />
  );
}
