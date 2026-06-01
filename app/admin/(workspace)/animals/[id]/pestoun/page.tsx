import { notFound, redirect } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isTreatmentActive } from "@/lib/animal-health";
import { isCarerFull, evaluateCarer, type Criterion } from "@/lib/animal-foster";
import { fosterTagLabelPlain } from "@/lib/foster-tags";
import { isClosedStatus } from "@/lib/animal-tabs-layout";
import type {
  AdoptionStatus,
  AnimalConditionRow,
  FosterCarerRow,
  FosterCheckinRow,
  FosterCommunicationRow,
  FosterPlacementRow,
  Species,
  TreatmentRow,
} from "@/types/database";

import { FosterView, type FosterVM } from "../foster-view";

export const metadata = { title: "Pěstoun — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

const DAY = 86_400_000;
const todayISO = () => new Date().toISOString().slice(0, 10);
function czDate(iso: string | null): string | null {
  return iso ? new Date(iso + "T00:00:00").toLocaleDateString("cs-CZ") : null;
}
function daysFromToday(iso: string): number {
  return Math.round(
    (new Date(iso + "T00:00:00").getTime() - new Date(todayISO() + "T00:00:00").getTime()) / DAY,
  );
}

export default async function AnimalFosterPage({ params }: PageProps) {
  const { id } = await params;
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const { data: inst } = await supabase
    .from("institutions")
    .select("foster_fee_enabled, foster_enabled, housing_mode")
    .eq("id", institutionId)
    .maybeSingle();
  const cfg = inst as {
    foster_fee_enabled: boolean | null;
    foster_enabled: boolean | null;
    housing_mode: "physical" | "foster_network" | "hybrid" | null;
  } | null;
  if (cfg?.foster_enabled === false) redirect(`/admin/animals/${id}`);

  const { data: animal } = await supabase
    .from("animals")
    .select(
      "id, species, size, adoption_status, age_months, age_years, birth_date, good_with_children, good_with_dogs, good_with_cats, needs_garden",
    )
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!animal) notFound();
  const a = animal as {
    species: Species;
    size: string | null;
    adoption_status: AdoptionStatus;
    age_months: number | null;
    age_years: number | null;
    birth_date: string | null;
    good_with_children: "yes" | "no" | "unknown" | null;
    good_with_dogs: "yes" | "no" | "unknown" | null;
    good_with_cats: "yes" | "no" | "unknown" | null;
    needs_garden: boolean | null;
  };

  const [
    { data: placementData },
    { data: carerData },
    { data: openPlacements },
    { data: checkinData },
    { data: commData },
    { data: treatData },
    { data: condData },
  ] = await Promise.all([
    supabase
      .from("foster_placements")
      .select("*, foster_carers(name, phone, city, capacity, tags, is_active)")
      .eq("animal_id", id)
      .order("started_on", { ascending: false }),
    supabase.from("foster_carers").select("*").eq("institution_id", institutionId).eq("is_active", true).order("name"),
    supabase.from("foster_placements").select("carer_id").eq("institution_id", institutionId).is("ended_on", null),
    supabase.from("foster_checkins").select("*").eq("animal_id", id).order("checked_on", { ascending: false }),
    supabase.from("foster_communications").select("*").eq("animal_id", id).order("created_at", { ascending: false }),
    supabase.from("treatments").select("start_date, end_date").eq("animal_id", id),
    supabase.from("animal_conditions").select("*").eq("animal_id", id),
  ]);

  const placements = (placementData ?? []) as (FosterPlacementRow & {
    foster_carers: {
      name: string;
      phone: string | null;
      city: string | null;
      capacity: number | null;
      tags: string[] | null;
      is_active: boolean;
    } | null;
  })[];
  const carers = (carerData ?? []) as FosterCarerRow[];
  const checkins = (checkinData ?? []) as FosterCheckinRow[];
  const comms = (commData ?? []) as FosterCommunicationRow[];
  const treatments = (treatData ?? []) as TreatmentRow[];
  const conditions = (condData ?? []) as AnimalConditionRow[];

  const activeByCarer = new Map<string, number>();
  for (const p of (openPlacements ?? []) as { carer_id: string }[]) {
    activeByCarer.set(p.carer_id, (activeByCarer.get(p.carer_id) ?? 0) + 1);
  }

  // Požadavky zvířete = jen AUTO-OVĚŘITELNÉ klíče z číselníku (přesné párování).
  const hasActiveMed = treatments.some((t) => isTreatmentActive(t));
  const ageMonths =
    a.age_months != null
      ? a.age_months + (a.age_years ?? 0) * 12
      : a.birth_date
        ? Math.floor((Date.now() - new Date(a.birth_date).getTime()) / (30 * 86_400_000))
        : null;
  const criteria: Criterion[] = [];
  const req = (key: string, severity: Criterion["severity"]) =>
    criteria.push({ key, kind: "require", severity });
  const exc = (key: string, severity: Criterion["severity"]) =>
    criteria.push({ key, kind: "exclude", severity });

  // Druh & velikost = blokující (kočku nenabídnu pěstounovi bez koček).
  if (a.species === "dog") req(a.size === "large" || a.size === "xlarge" ? "big_dogs" : "small_dogs", "block");
  if (a.species === "cat") req("cats", "block");
  if (a.species === "rabbit" || a.species === "other") req("small_animals", "block");
  // Péče = důležité.
  if (ageMonths != null && ageMonths < 6) req("puppies", "important");
  if (hasActiveMed) req("meds", "important");
  // Existence chronických stavů (strukturovaný signál) → pooperační péče.
  if (conditions.length > 0) req("post_op", "important");
  // Prostředí — ověřitelné ze snášenlivosti a potřeby zahrady.
  if (a.needs_garden === true) req("garden", "nice");
  if (a.good_with_children === "no") {
    req("no_children", "important");
    exc("children", "block"); // nesnáší děti → domácnost s dětmi je vyloučená
  }
  if (a.good_with_dogs === "no" || a.good_with_cats === "no") exc("other_pets", "block");

  const requirements = criteria.filter((c) => c.kind === "require").map((c) => c.key);
  const exclusions = criteria.filter((c) => c.kind === "exclude").map((c) => c.key);

  const active = placements.find((p) => p.ended_on === null) ?? null;
  let activeVM: FosterVM["active"] = null;
  if (active) {
    const carerTags = active.foster_carers?.tags ?? [];
    const met = requirements.filter((r) => carerTags.includes(r));
    const exclusionsRespected = exclusions.filter((x) => !carerTags.includes(x));
    const elapsed = -daysFromToday(active.started_on);
    activeVM = {
      placementId: active.id,
      carer: {
        name: active.foster_carers?.name ?? "—",
        phone: active.foster_carers?.phone ?? null,
        city: active.foster_carers?.city ?? null,
        capacity: active.foster_carers?.capacity ?? null,
        activePlacements: activeByCarer.get(active.carer_id) ?? 0,
        tags: carerTags,
        approved: active.foster_carers?.is_active ?? false,
      },
      careType: active.care_type,
      started: czDate(active.started_on) ?? "",
      day: Math.max(1, elapsed + 1),
      plannedUntil: czDate(active.planned_until),
      daysLeft: active.planned_until ? daysFromToday(active.planned_until) : null,
      fee: active.fee,
      contractUrl: active.contract_url,
      requirementsMet: met,
      exclusions,
      exclusionsRespected,
    };
  }

  const matches: FosterVM["matches"] = carers
    .map((c) => {
      const ap = activeByCarer.get(c.id) ?? 0;
      const full = isCarerFull(c.capacity, ap);
      const ev = evaluateCarer(c.tags, criteria, full);
      const breakdown = [
        ...ev.results.map((r) => ({
          label: r.kind === "exclude" ? `bez „${fosterTagLabelPlain(r.key)}"` : fosterTagLabelPlain(r.key),
          ok: r.ok,
          severity: r.severity,
        })),
        {
          label: full ? "kapacita plná" : "volná kapacita",
          ok: !full,
          severity: "important" as const,
        },
      ];
      return {
        id: c.id,
        name: c.name,
        city: c.city,
        tags: c.tags ?? [],
        capacity: c.capacity,
        activePlacements: ap,
        full,
        blocked: ev.blocked,
        score: ev.score,
        tone: ev.tone,
        breakdown,
      };
    })
    .sort((x, y) => {
      const px = x.full ? 3 : x.blocked ? 2 : 0;
      const py = y.full ? 3 : y.blocked ? 2 : 0;
      return px === py ? y.score - x.score : px - py;
    });

  let nextCheck: FosterVM["nextCheck"] = null;
  if (active) {
    const baseIso = checkins[0]?.checked_on ?? active.started_on;
    const next = new Date(baseIso + "T00:00:00");
    next.setDate(next.getDate() + 30);
    const nIso = next.toISOString().slice(0, 10);
    nextCheck = { date: czDate(nIso) ?? "", daysLeft: daysFromToday(nIso) };
  }

  const history = placements
    .filter((p) => p.ended_on !== null)
    .map((p) => ({
      id: p.id,
      carerName: p.foster_carers?.name ?? "—",
      careType: p.care_type,
      range: `${czDate(p.started_on)} – ${czDate(p.ended_on)}`,
      endReason: p.end_reason,
    }));

  return (
    <FosterView
      animalId={id}
      readOnly={isClosedStatus(a.adoption_status)}
      feeEnabled={cfg?.foster_fee_enabled ?? false}
      housingMode={cfg?.housing_mode ?? "physical"}
      active={activeVM}
      requirements={requirements}
      exclusions={exclusions}
      matches={matches}
      checkins={checkins.map((c) => ({
        id: c.id,
        date: czDate(c.checked_on) ?? "",
        method: c.method,
        note: c.note,
        photos: c.photos ?? [],
      }))}
      nextCheck={nextCheck}
      communications={comms.map((c) => ({ id: c.id, at: c.created_at, kind: c.kind, note: c.note }))}
      history={history}
    />
  );
}
