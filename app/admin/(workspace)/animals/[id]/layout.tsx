import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Home, Lock } from "lucide-react";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ADOPTION_STATUS_LABEL,
  ADOPTION_STATUS_PILL,
  ANIMAL_LEGAL_STATUS_LABEL,
  ANIMAL_LEGAL_STATUS_PILL,
  HEALTH_STATUS_LABEL,
  SPECIES_LABEL,
  SUPERVISION_STATUS_LABEL,
  SUPERVISION_STATUS_PILL,
} from "@/lib/format";
import {
  evaluateReadiness,
  publishReadiness,
  type ReadinessInput,
} from "@/lib/animal-readiness";
import {
  getAnimalTabsLayout,
  isClosedStatus,
} from "@/lib/animal-tabs-layout";
import { displayHealthStatus, isTreatmentActive } from "@/lib/animal-health";
import { animalAgeLabel } from "@/lib/animal-age";
import { cn } from "@/lib/utils";
import type {
  AdoptionStatus,
  AnimalLegalStatus,
  AnimalSupervisionStatus,
  HealthStatus,
  Species,
} from "@/types/database";

import { AnimalTabs } from "./animal-tabs";
import { AutoPublishToggle } from "./auto-publish-toggle";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

interface HeaderRow extends ReadinessInput {
  id: string;
  name: string;
  species: Species;
  breed: string | null;
  age_years: number | null;
  age_months: number | null;
  birth_date: string | null;
  record_number: string | null;
  health_status: HealthStatus;
  adoption_status: AdoptionStatus;
  protection_until: string | null;
  auto_publish: boolean;
  kennel_id: string | null;
  kennels: { name: string } | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

/** Počet zbývajících dní do data (může být záporný). */
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const end = new Date(iso + "T00:00:00").getTime();
  const now = Date.now();
  return Math.ceil((end - now) / 86_400_000);
}

export default async function AnimalHubLayout({
  children,
  params,
}: LayoutProps) {
  const { id } = await params;
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const { data: instCfg } = await supabase
    .from("institutions")
    .select("housing_mode, foster_enabled")
    .eq("id", institutionId)
    .maybeSingle();
  const housingMode =
    (instCfg as { housing_mode: "physical" | "foster_network" | "hybrid" } | null)
      ?.housing_mode ?? "physical";
  const fosterEnabled =
    (instCfg as { foster_enabled: boolean } | null)?.foster_enabled ?? true;

  const { data } = await supabase
    .from("animals")
    .select(
      `id, name, species, breed, age_years, age_months, birth_date,
       primary_photo_url, record_number, health_status, adoption_status,
       legal_status, protection_until, supervision_status, auto_publish,
       intake_type, intake_date, found_date, chip_number, tattoo, ear_tag,
       identification_none, is_vaccinated, published_at,
       kennel_id, kennels(name)`,
    )
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!data) notFound();
  const a = data as unknown as HeaderRow;

  // Existence strukturovaných záznamů — pro stavově řízené záložky.
  const [foster, quarantine, adoption, exit, trial, lastObs, treatData] = await Promise.all([
    supabase
      .from("foster_placements")
      .select("id", { count: "exact", head: true })
      .eq("animal_id", id),
    supabase
      .from("quarantine_records")
      .select("id", { count: "exact", head: true })
      .eq("animal_id", id),
    supabase
      .from("adoptions")
      .select("id", { count: "exact", head: true })
      .eq("animal_id", id),
    supabase
      .from("animal_exit_records")
      .select("id", { count: "exact", head: true })
      .eq("animal_id", id),
    supabase
      .from("adoptions")
      .select("id", { count: "exact", head: true })
      .eq("animal_id", id)
      .eq("stage", "trial"),
    supabase
      .from("quarantine_observations")
      .select("flag")
      .eq("animal_id", id)
      .order("observed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("treatments")
      .select("start_date, end_date")
      .eq("animal_id", id),
  ]);

  const has = (r: { count: number | null }) => (r.count ?? 0) > 0;
  const quarantineWatch =
    (lastObs.data as { flag: string } | null)?.flag === "watch";

  // Zdravotní stav v hlavičce odvozujeme stejně jako záložka Zdraví —
  // běží-li aktivní léčba, ukáže „V léčbě" (jinak rozpor se záložkou).
  const hasActiveTreatment = (
    (treatData.data ?? []) as { start_date: string | null; end_date: string | null }[]
  ).some((t) => isTreatmentActive(t));
  const healthDisplay = displayHealthStatus(a.health_status, hasActiveTreatment);

  const readiness = evaluateReadiness(a);
  const layout = getAnimalTabsLayout({
    adoptionStatus: a.adoption_status,
    legalStatus: a.legal_status,
    supervisionStatus: a.supervision_status,
    kennelId: a.kennel_id,
    housingMode,
    fosterEnabled,
    history: {
      foster: has(foster),
      quarantine: has(quarantine),
      adoption: has(adoption),
      exit: has(exit),
      trial: has(trial),
      quarantineWatch,
    },
    readiness,
  });

  const closed = isClosedStatus(a.adoption_status);
  const inProtection = a.legal_status === "in_protection";
  const protectionDays = daysUntil(a.protection_until);

  // Předpověď automatiky: po skončení lhůty se zvíře pokusí samo zveřejnit,
  // pokud má auto_publish a ostatní tvrdé body publish jsou splněné.
  const publishHardPending = publishReadiness({
    ...a,
    legal_status: "shelter_owned",
  }).pending;
  const willAutoPublish =
    inProtection && a.auto_publish && publishHardPending.length === 0;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/admin/animals"
        className="inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-sage-700"
      >
        <ChevronLeft className="size-4" /> Zpět na zvířata
      </Link>

      <div className="flex flex-wrap items-center gap-4 rounded-xl bg-cream p-5 ring-1 ring-ink-900/8">
        <div className="size-20 shrink-0 overflow-hidden rounded-lg bg-cream-warm">
          {a.primary_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={a.primary_photo_url}
              alt={a.name}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-4xl">
              🐾
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">
              {a.name}
            </h1>
            {a.record_number && (
              <span className="rounded-pill bg-cream-warm px-2.5 py-0.5 font-display text-xs font-bold tracking-wide text-ink-500">
                {a.record_number}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-600">
            <span>
              {[SPECIES_LABEL[a.species], a.breed, animalAgeLabel(a)]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {a.kennels?.name && (
              <span className="inline-flex items-center gap-1 text-ink-500">
                <Home className="size-3.5" /> {a.kennels.name}
              </span>
            )}
          </div>

          {/* Stavové štítky os */}
          <div className="mt-3 flex flex-wrap gap-2">
            <AxisBadge label="Cyklus" className={ADOPTION_STATUS_PILL[a.adoption_status]}>
              {ADOPTION_STATUS_LABEL[a.adoption_status]}
            </AxisBadge>
            {a.legal_status !== "shelter_owned" && (
              <AxisBadge label="Právo" className={ANIMAL_LEGAL_STATUS_PILL[a.legal_status]}>
                {ANIMAL_LEGAL_STATUS_LABEL[a.legal_status]}
              </AxisBadge>
            )}
            <AxisBadge
              label="Zdraví"
              className={
                healthDisplay.value === "treated"
                  ? "bg-sage-100 text-sage-700"
                  : healthDisplay.value === "special_needs"
                    ? "bg-sunshine-200 text-ink-700"
                    : healthDisplay.value === "healthy"
                      ? "bg-fern-50 text-fern-700"
                      : "bg-cream-warm text-ink-600"
              }
            >
              {healthDisplay.value === "treated" ? "🏥 " : ""}
              {HEALTH_STATUS_LABEL[healthDisplay.value] ?? healthDisplay.value}
            </AxisBadge>
            {a.supervision_status !== "released" && (
              <AxisBadge
                label="Dohled"
                className={SUPERVISION_STATUS_PILL[a.supervision_status]}
              >
                {SUPERVISION_STATUS_LABEL[a.supervision_status]}
              </AxisBadge>
            )}
          </div>
        </div>
      </div>

      {closed && (
        <div className="flex items-center gap-3 rounded-xl bg-ink-900/5 p-4 text-sm ring-1 ring-inset ring-ink-900/10">
          <Lock className="size-5 shrink-0 text-ink-500" />
          <p className="font-semibold text-ink-700">
            Případ je uzavřen — karta je jen ke čtení.
          </p>
        </div>
      )}

      {inProtection && (
        <div className="flex items-start gap-3 rounded-xl bg-sunshine-200 p-4 text-sm ring-1 ring-inset ring-sunshine-400/40">
          <span className="text-lg">⏳</span>
          <div>
            <p className="font-semibold text-ink-900">
              Zvíře je v ochranné lhůtě
              {protectionDays != null && protectionDays >= 0 && (
                <span className="ml-2 rounded-pill bg-sunshine-500/30 px-2 py-0.5 text-xs font-bold text-ink-800">
                  zbývá {protectionDays} dní
                </span>
              )}
            </p>
            <p className="mt-0.5 text-ink-700">
              Původní majitel se může přihlásit
              {a.protection_until ? <> do {formatDate(a.protection_until)}</> : null}
              . Trvalá adopce, zveřejnění k adopci ani převod nejsou možné, dokud
              lhůta neskončí.
            </p>
            {willAutoPublish && (
              <p className="mt-1 text-ink-700">
                ⚙️ Po konci lhůty se zvíře pokusí samo přejít na „K adopci".
              </p>
            )}
            <div>
              <AutoPublishToggle animalId={a.id} initial={a.auto_publish} />
            </div>
            <span className="mt-2 inline-block rounded-pill bg-sage-100 px-3 py-1 text-xs font-semibold text-sage-700">
              ✓ Povoleno i během lhůty: pěstounská péče + katalog nalezenců
            </span>
          </div>
        </div>
      )}

      {(a.supervision_status === "quarantine" ||
        a.supervision_status === "isolation") && (
        <div className="flex items-start gap-3 rounded-xl bg-peach-100 p-4 text-sm ring-1 ring-inset ring-peach-300/60">
          <span className="text-lg">🧫</span>
          <div>
            <p className="font-semibold text-ink-900">
              {a.supervision_status === "isolation"
                ? "Zvíře je v izolaci"
                : "Zvíře je v karanténě"}
            </p>
            <p className="mt-0.5 text-ink-700">
              Drž ho odděleně od ostatních zvířat. Detail a ukončení najdeš v
              záložce Karanténa.
            </p>
          </div>
        </div>
      )}

      <AnimalTabs animalId={a.id} layout={layout} />

      <div>{children}</div>
    </div>
  );
}

function AxisBadge({
  label,
  className,
  children,
}: {
  label: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-xs font-semibold",
        className,
      )}
    >
      <span className="text-[10px] font-bold uppercase tracking-wide opacity-60">
        {label}
      </span>
      {children}
    </span>
  );
}
