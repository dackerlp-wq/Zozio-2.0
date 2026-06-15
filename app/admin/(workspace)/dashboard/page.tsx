import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";

import { ZozioButton } from "@/components/zozio/button";
import { requireMembership } from "@/lib/auth";
import { READINESS_SELECT } from "@/lib/animal-readiness";
import {
  CLOSED_STATUSES,
  computeStateCounts,
  DASHBOARD_PERIODS,
  isReadyNotPublished,
  parsePeriod,
  periodStartISO,
  type DashAnimal,
} from "@/lib/animal-dashboard";
import { taskOpenHref, taskSourceMeta } from "@/lib/animal-tasks";
import { ADOPTION_STATUS_LABEL } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
import type { AnimalTaskType } from "@/types/database";

import { AttentionList, type AttentionItem } from "./attention-actions";
import { OnboardingBanner } from "./onboarding-banner";

export const metadata = { title: "Přehled — Zozio Admin" };

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 10) return "Dobré ráno";
  if (h < 18) return "Dobrý den";
  return "Dobrý večer";
}
function kc(n: number): string {
  return `${Math.round(n).toLocaleString("cs-CZ")} Kč`;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const { institutionId, institution, role } = await requireMembership();
  const supabase = await createClient();
  const period = parsePeriod((await searchParams).period);
  const todayStr = new Date().toISOString().slice(0, 10);
  const periodStart = periodStartISO(period);

  const agingBefore = new Date(Date.now() - 5 * 86_400_000).toISOString();

  const [
    { data: animalData },
    { count: newApplications },
    { data: openTasks },
    { data: kennelData },
    { data: events },
    { data: costData },
    { data: donationData },
    { data: instCfg },
    { count: agingApplications },
    { count: muniCount },
    { count: memberCount },
  ] = await Promise.all([
    supabase
      .from("animals")
      .select(`id, name, adoption_status, created_at, kennel_id, protection_until, ${READINESS_SELECT}`)
      .eq("institution_id", institutionId),
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", institutionId)
      .eq("status", "new"),
    supabase
      .from("animal_tasks")
      .select("id, title, type, due_date, animal_id, snoozed_until, animals(name)")
      .eq("institution_id", institutionId)
      .eq("status", "open")
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(500),
    supabase
      .from("kennels")
      .select("capacity, status")
      .eq("institution_id", institutionId),
    supabase
      .from("animal_status_events")
      .select("id, to_status, from_status, created_at, animals(name)")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase.from("animal_costs").select("amount").eq("institution_id", institutionId).limit(2000),
    supabase
      .from("animal_donations")
      .select("amount, kind")
      .eq("institution_id", institutionId)
      .limit(2000),
    supabase
      .from("institutions")
      .select("housing_mode, foster_enabled")
      .eq("id", institutionId)
      .maybeSingle(),
    supabase
      .from("applications")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", institutionId)
      .eq("status", "new")
      .lte("created_at", agingBefore),
    supabase
      .from("shelter_municipalities")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", institutionId),
    supabase
      .from("institution_members")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", institutionId),
  ]);

  const animals = (animalData ?? []) as unknown as DashAnimal[];
  const housingMode =
    (instCfg as { housing_mode: "physical" | "foster_network" | "hybrid" | null } | null)
      ?.housing_mode ?? "physical";

  // KPI + trendy
  const totalAnimals = animals.length;
  const availableCount = animals.filter((a) => a.adoption_status === "available").length;
  const newInPeriod = animals.filter((a) => a.created_at.slice(0, 10) >= periodStart).length;

  // Úkoly (open, ne-snoozed)
  type DTask = {
    id: string;
    title: string;
    type: AnimalTaskType;
    due_date: string | null;
    animal_id: string | null;
    snoozed_until: string | null;
    animals: { name: string } | null;
  };
  const tasks = ((openTasks ?? []) as unknown as DTask[]).filter(
    (t) => !t.snoozed_until || t.snoozed_until <= todayStr,
  );
  const overdue = tasks.filter((t) => t.due_date && t.due_date < todayStr).length;
  const todayTasks = tasks.filter((t) => t.due_date === todayStr).length;
  const urgentTasks = tasks.filter((t) => t.due_date && t.due_date <= todayStr).slice(0, 5);

  const counts = computeStateCounts(animals, todayStr);

  // Pozornost (max 6, jednoklik akce)
  const attention: AttentionItem[] = [];
  for (const a of animals) {
    if (attention.length >= 6) break;
    if (isReadyNotPublished(a)) {
      attention.push({
        animalId: a.id,
        icon: "🌐",
        title: `${a.name} — připraveno k adopci`,
        detail: "Splňuje podmínky, ale není na webu.",
        action: "publish",
        actionLabel: "Zveřejnit k adopci",
      });
    } else if (a.legal_status === "in_protection" && !CLOSED_STATUSES.includes(a.adoption_status)) {
      const foundEligible = a.intake_type === "found" && !a.published_at;
      attention.push({
        animalId: a.id,
        icon: "⏳",
        title: `${a.name} — v ochranné lhůtě`,
        detail: foundEligible
          ? "K adopci nelze; lze do katalogu nalezenců."
          : "Vyřeš právní stav → pak lze k adopci.",
        action: foundEligible ? "found_listing" : "to_shelter",
        actionLabel: foundEligible ? "Zveřejnit jako nalezence" : "Převést na útulek",
      });
    } else if (
      !CLOSED_STATUSES.includes(a.adoption_status) &&
      (a.supervision_status === "quarantine" || a.supervision_status === "isolation")
    ) {
      attention.push({
        animalId: a.id,
        icon: "🛡️",
        title: `${a.name} — probíhá dohled`,
        detail: "Po ukončení karantény/izolace se zvíře zveřejní.",
        action: "end_supervision",
        actionLabel: "Ukončit dohled",
      });
    }
  }

  // Obsazenost
  const kennels = (kennelData ?? []) as { capacity: number; status: string }[];
  const activeCapacity = kennels
    .filter((k) => k.status === "active")
    .reduce((s, k) => s + k.capacity, 0);
  const occupied = animals.filter(
    (a) => a.kennel_id && !CLOSED_STATUSES.includes(a.adoption_status),
  ).length;
  const occPct = activeCapacity > 0 ? Math.min(100, Math.round((occupied / activeCapacity) * 100)) : 0;

  // Finance
  const expenseTotal = ((costData ?? []) as { amount: number }[]).reduce((s, c) => s + c.amount, 0);
  const incomeTotal = ((donationData ?? []) as { amount: number | null; kind: string }[])
    .filter((d) => d.kind === "money")
    .reduce((s, d) => s + (d.amount ?? 0), 0);
  const finMax = Math.max(expenseTotal, incomeTotal, 1);

  // Onboarding — kroky podle typu provozu útulku.
  const hasPhysical = housingMode === "physical" || housingMode === "hybrid";
  const onboardingSteps = [
    { label: "Profil útulku", done: true, href: "/admin/settings" },
    ...(hasPhysical
      ? [{ label: "Kotce", done: (kennelData ?? []).length > 0, href: "/admin/kennels" }]
      : []),
    { label: "První zvíře", done: totalAnimals > 0, href: "/admin/animals/new" },
    { label: "Spádová oblast", done: (muniCount ?? 0) > 0, href: "/admin/settings?sekce=spadova" },
    { label: "Pozvat tým", done: (memberCount ?? 0) > 1, href: "/admin/team" },
    { label: "Zveřejnit katalog", done: institution.is_published, href: "/admin/settings" },
  ];

  const kpis = [
    { label: "Zvířat celkem", value: totalAnimals, href: "/admin/animals", trend: newInPeriod > 0 ? `▲ +${newInPeriod} za období` : "beze změny", alert: false },
    { label: "Zveřejněno k adopci", value: availableCount, href: "/admin/animals?status=available", trend: "—", alert: false },
    { label: "Nové žádosti", value: newApplications ?? 0, href: "/admin/applications", trend: "—", alert: false },
    {
      label: "Úkoly k řešení dnes",
      value: overdue + todayTasks,
      href: "/admin/tasks",
      trend: overdue > 0 ? `${overdue} po termínu` : todayTasks > 0 ? `${todayTasks} dnes` : "—",
      alert: overdue > 0,
    },
  ];

  const strip = [
    { icon: "⏳", value: counts.inProtection, label: "V ochranné lhůtě" },
    { icon: "🛡️", value: counts.inSupervision, label: "V karanténě / dohledu" },
    { icon: "📅", value: counts.longStay, label: "Dlouhodobci 90+ dní" },
    { icon: "🌐", value: counts.readyNotPublished, label: "Připraveno k adopci, ne na webu" },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <OnboardingBanner steps={onboardingSteps} />

      {/* Pozdrav + období */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
            {greeting()} 👋
          </h2>
          <p className="mt-1 text-ink-600">Přehled tvého útulku {institution.name}.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-pill ring-1 ring-ink-900/10">
            {DASHBOARD_PERIODS.map((p) => (
              <Link
                key={p.key}
                href={`/admin/dashboard?period=${p.key}`}
                className={cn(
                  "px-4 py-2 text-sm font-bold",
                  period === p.key ? "bg-ink-900 text-cream" : "bg-cream text-ink-600 hover:bg-cream-warm",
                )}
              >
                {p.label}
              </Link>
            ))}
          </div>
          <ZozioButton asChild variant="meadow" size="md">
            <Link href="/admin/animals/new">
              <Plus /> Přidat zvíře
            </Link>
          </ZozioButton>
        </div>
      </div>

      {/* KPI */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => (
          <Link
            key={k.label}
            href={k.href}
            className="group rounded-3xl bg-cream p-5 ring-1 ring-ink-900/8 transition hover:-translate-y-0.5 hover:shadow-soft-md"
          >
            <div className="font-display text-4xl font-bold tracking-tight text-ink-900">{k.value}</div>
            <div className="mt-1 text-sm font-semibold text-ink-600">{k.label}</div>
            <div className={cn("mt-1 text-xs font-bold", k.alert ? "text-terracotta-600" : "text-ink-400")}>
              {k.trend}
            </div>
          </Link>
        ))}
      </div>

      {/* Stav zvířat strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {strip.map((s) => (
          <Link
            key={s.label}
            href="/admin/animals"
            className="flex items-center gap-3 rounded-xl bg-cream-warm/70 p-3 ring-1 ring-ink-900/8 hover:ring-meadow-300"
          >
            <span className="text-xl">{s.icon}</span>
            <div>
              <div className="font-display text-xl font-bold text-ink-900">{s.value}</div>
              <div className="text-[11px] font-bold text-ink-500">{s.label}</div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        {/* LEVÝ sloupec */}
        <div className="space-y-5">
          {/* Co dnes řešit */}
          <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-ink-900">🔔 Co dnes řešit</h3>
              <Link href="/admin/tasks" className="text-sm font-bold text-meadow-600 hover:text-meadow-700">
                Všechny úkoly →
              </Link>
            </div>
            {urgentTasks.length === 0 ? (
              <p className="mt-3 text-sm text-ink-500">Nic urgentního na dnešek. 🎉</p>
            ) : (
              <div className="mt-3">
                {urgentTasks.map((t) => {
                  const over = t.due_date && t.due_date < todayStr;
                  return (
                    <Link
                      key={t.id}
                      href={taskOpenHref(t.type, t.animal_id)}
                      className="flex items-center gap-3 border-b border-ink-900/5 py-2.5 last:border-none"
                    >
                      <span className={cn("shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-bold", taskSourceMeta(t.type).tone)}>
                        {taskSourceMeta(t.type).label}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-900">{t.title}</span>
                      <span
                        className={cn(
                          "shrink-0 rounded-pill px-2 py-0.5 text-[11px] font-bold",
                          over ? "bg-peach-200 text-terracotta-600" : "bg-sunshine-200 text-sunshine-600",
                        )}
                      >
                        {over ? "po termínu" : "dnes"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Vyžaduje pozornost */}
          {(attention.length > 0 || (agingApplications ?? 0) > 0) && (
            <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
              <h3 className="font-display text-lg font-bold text-ink-900">
                ⚠️ Vyžaduje pozornost{" "}
                <span className="ml-1 rounded-pill bg-peach-200 px-2 py-0.5 text-xs font-bold text-terracotta-600">
                  {attention.length + ((agingApplications ?? 0) > 0 ? 1 : 0)}
                </span>
              </h3>
              {(agingApplications ?? 0) > 0 && (
                <Link
                  href="/admin/applications"
                  className="mt-3 flex items-center gap-2 rounded-xl bg-sunshine-200/60 p-3 text-sm font-bold text-ink-700 ring-1 ring-inset ring-sunshine-400/40 hover:bg-sunshine-200"
                >
                  📨 {agingApplications} {agingApplications === 1 ? "nová žádost čeká" : "nových žádostí čeká"} 5+ dní bez reakce
                  <span className="ml-auto text-meadow-700">Vyřídit →</span>
                </Link>
              )}
              {attention.length > 0 && (
                <div className="mt-3">
                  <AttentionList items={attention} />
                </div>
              )}
            </section>
          )}
        </div>

        {/* PRAVÝ sloupec */}
        <div className="space-y-5">
          {/* Obsazenost */}
          <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
            <h3 className="font-display text-lg font-bold text-ink-900">🏘️ Obsazenost</h3>
            {housingMode === "foster_network" ? (
              <p className="mt-3 text-sm text-ink-500">
                Síťový útulek — ustájení řeší pěstouni. Přehled péče najdeš v sekci Pěstouni.
              </p>
            ) : (
              <>
                <div className="mt-3 h-3 overflow-hidden rounded-pill bg-ink-900/8">
                  <div className="h-full rounded-pill bg-meadow-500" style={{ width: `${occPct}%` }} />
                </div>
                <div className="mt-2 flex justify-between text-sm font-bold text-ink-600">
                  <span>Kotce: {occupied} / {activeCapacity} obsazeno</span>
                  <span>{Math.max(0, activeCapacity - occupied)} volných</span>
                </div>
              </>
            )}
          </section>

          {/* Finance & sbírka */}
          <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-ink-900">💚 Finance &amp; sbírka</h3>
              <span className="rounded-pill bg-ink-900/8 px-2 py-0.5 text-[10px] font-bold text-ink-500">souhrn</span>
            </div>
            <div className="mt-3 space-y-2">
              <FinRow label="Příjmy" value={incomeTotal} max={finMax} tone="bg-fern-600" valueCls="text-fern-700" />
              <FinRow label="Výdaje" value={expenseTotal} max={finMax} tone="bg-meadow-500" valueCls="text-meadow-700" />
            </div>
            <div className="mt-3 rounded-xl bg-cream-warm/70 p-3 text-sm text-ink-500 ring-1 ring-ink-900/8">
              🐾 <b className="text-ink-700">Sbírky</b> — modul připravujeme. Veřejné sbírky a Darujme.cz
              dary se sem propíšou, až bude hotový.
            </div>
          </section>

          {/* Rychlé akce */}
          <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
            <h3 className="font-display text-lg font-bold text-ink-900">⚡ Rychlé akce</h3>
            <div className="mt-3 flex flex-col gap-2">
              <QuickLink href="/admin/animals/new" label="🐾 Přidat zvíře" />
              <QuickLink href="/admin/animals" label="📋 Spravovat zvířata" />
              <QuickLink href="/admin/settings" label="🏠 Upravit profil útulku" />
            </div>
          </section>

          {/* Nedávná aktivita */}
          {(events ?? []).length > 0 && (
            <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
              <h3 className="font-display text-lg font-bold text-ink-900">🕒 Nedávná aktivita</h3>
              <div className="mt-3">
                {((events ?? []) as unknown as {
                  id: string;
                  to_status: keyof typeof ADOPTION_STATUS_LABEL;
                  from_status: keyof typeof ADOPTION_STATUS_LABEL | null;
                  created_at: string;
                  animals: { name: string } | null;
                }[]).map((e) => (
                  <div key={e.id} className="flex gap-3 border-b border-ink-900/5 py-2 text-sm last:border-none">
                    <span className="w-14 shrink-0 text-[11px] font-bold text-ink-400">
                      {new Date(e.created_at).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" })}
                    </span>
                    <span className="text-ink-700">
                      <b className="text-ink-900">{e.animals?.name ?? "Zvíře"}</b>:{" "}
                      {e.from_status ? `${ADOPTION_STATUS_LABEL[e.from_status]} → ` : ""}
                      {ADOPTION_STATUS_LABEL[e.to_status]}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function FinRow({ label, value, max, tone, valueCls }: { label: string; value: number; max: number; tone: string; valueCls: string }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-16 shrink-0 font-bold text-ink-500">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-pill bg-ink-900/8">
        <span className={cn("block h-full rounded-pill", tone)} style={{ width: `${Math.round((value / max) * 100)}%` }} />
      </span>
      <span className={cn("min-w-[80px] text-right font-bold", valueCls)}>{kc(value)}</span>
    </div>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-xl bg-cream-warm/70 px-4 py-3 text-sm font-bold text-ink-800 ring-1 ring-ink-900/8 hover:bg-cream-warm hover:ring-meadow-300"
    >
      {label}
      <ArrowUpRight className="ml-auto size-4 text-ink-400" />
    </Link>
  );
}
