import { notFound } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  buildAnimalCriteria,
  evaluateCarer,
  isCarerFull,
} from "@/lib/animal-foster";
import { isTreatmentActive } from "@/lib/animal-health";
import { fosterTagLabelPlain } from "@/lib/foster-tags";
import type {
  AdoptionStatus,
  AnimalSize,
  Compatibility,
  FosterCarerRow,
  Species,
} from "@/types/database";

import type { FosterCarerValues } from "../actions";
import {
  CarerDetail,
  type CandidateVM,
  type PlacementRow,
  type ReimbursementVM,
  type TimelineEntry,
} from "./carer-detail";

export const metadata = { title: "Pěstoun — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

const TERMINAL: AdoptionStatus[] = ["adopted", "transferred", "deceased"];

export default async function FosterCarerPage({ params }: PageProps) {
  const { id } = await params;
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const { data: carerData } = await supabase
    .from("foster_carers")
    .select("*")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!carerData) notFound();
  const carer = carerData as FosterCarerRow;

  const { data: placementData } = await supabase
    .from("foster_placements")
    .select(
      "id, animal_id, started_on, planned_until, ended_on, end_reason, fee, notes, animals(name, species)",
    )
    .eq("carer_id", id)
    .order("started_on", { ascending: false });

  const placements: PlacementRow[] = (
    (placementData ?? []) as {
      id: string;
      animal_id: string;
      started_on: string;
      planned_until: string | null;
      ended_on: string | null;
      end_reason: string | null;
      fee: number | null;
      notes: string | null;
      animals: { name: string; species: Species } | null;
    }[]
  ).map((p) => ({
    id: p.id,
    animalId: p.animal_id,
    animalName: p.animals?.name ?? "—",
    species: p.animals?.species ?? null,
    started_on: p.started_on,
    planned_until: p.planned_until,
    ended_on: p.ended_on,
    end_reason: p.end_reason,
    fee: p.fee,
    notes: p.notes,
  }));

  const activeCount = placements.filter((p) => !p.ended_on).length;
  const full = isCarerFull(carer.capacity, activeCount);
  const placementIds = placements.map((p) => p.id);
  const activeAnimalIds = new Set(
    placements.filter((p) => !p.ended_on).map((p) => p.animalId),
  );

  // --- Kandidáti k umístění (provázanost pěstoun → zvíře) -------------------
  const { data: animalRows } = await supabase
    .from("animals")
    .select(
      "id, name, record_number, species, size, age_months, age_years, birth_date, good_with_children, good_with_dogs, good_with_cats, needs_garden, adoption_status, kennel_id",
    )
    .eq("institution_id", institutionId)
    .not("adoption_status", "in", `(${TERMINAL.join(",")})`)
    .order("name", { ascending: true });

  const animals = (animalRows ?? []) as {
    id: string;
    name: string;
    record_number: string | null;
    species: Species;
    size: AnimalSize | null;
    age_months: number | null;
    age_years: number | null;
    birth_date: string | null;
    good_with_children: Compatibility | null;
    good_with_dogs: Compatibility | null;
    good_with_cats: Compatibility | null;
    needs_garden: boolean | null;
    adoption_status: AdoptionStatus;
    kennel_id: string | null;
  }[];

  const candidateIds = animals
    .filter((a) => !activeAnimalIds.has(a.id) && a.adoption_status !== "foster")
    .map((a) => a.id);

  // Aktivní léčba + chronické stavy pro kandidáty (signály pro párování).
  const [{ data: treatRows }, { data: condRows }] = await Promise.all([
    candidateIds.length
      ? supabase
          .from("treatments")
          .select("animal_id, start_date, end_date")
          .in("animal_id", candidateIds)
      : Promise.resolve({ data: [] as never[] }),
    candidateIds.length
      ? supabase
          .from("animal_conditions")
          .select("animal_id")
          .in("animal_id", candidateIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const activeMed = new Set<string>();
  for (const t of (treatRows ?? []) as {
    animal_id: string;
    start_date: string | null;
    end_date: string | null;
  }[]) {
    if (isTreatmentActive(t)) activeMed.add(t.animal_id);
  }
  const hasCond = new Set<string>();
  for (const c of (condRows ?? []) as { animal_id: string }[])
    hasCond.add(c.animal_id);

  const candidates: CandidateVM[] = animals
    .filter((a) => candidateIds.includes(a.id))
    .map((a) => {
      const ageMonths =
        a.age_months != null
          ? a.age_months + (a.age_years ?? 0) * 12
          : a.birth_date
            ? Math.floor(
                (Date.now() - new Date(a.birth_date).getTime()) /
                  (30 * 86_400_000),
              )
            : null;
      const criteria = buildAnimalCriteria({
        species: a.species,
        size: a.size,
        ageMonths,
        hasActiveMed: activeMed.has(a.id),
        hasConditions: hasCond.has(a.id),
        needs_garden: a.needs_garden,
        good_with_children: a.good_with_children,
        good_with_dogs: a.good_with_dogs,
        good_with_cats: a.good_with_cats,
      });
      const ev = evaluateCarer(carer.tags, criteria, full);
      return {
        animalId: a.id,
        name: a.name,
        record: a.record_number,
        score: ev.score,
        tone: ev.tone,
        reasons: ev.results.map((r) => ({
          label:
            r.kind === "exclude"
              ? `bez „${fosterTagLabelPlain(r.key)}"`
              : fosterTagLabelPlain(r.key),
          ok: r.ok,
        })),
      };
    })
    .sort((x, y) => y.score - x.score)
    .slice(0, 6);

  // --- Časová osa: check-iny + komunikace napříč umístěními pěstouna --------
  const timeline: TimelineEntry[] = [];
  if (placementIds.length) {
    const [{ data: checkins }, { data: comms }] = await Promise.all([
      supabase
        .from("foster_checkins")
        .select("id, checked_on, method, note, animals(name)")
        .in("placement_id", placementIds)
        .order("checked_on", { ascending: false }),
      supabase
        .from("foster_communications")
        .select("id, kind, note, created_at, animals(name)")
        .in("placement_id", placementIds)
        .order("created_at", { ascending: false }),
    ]);
    for (const c of (checkins ?? []) as {
      id: string;
      checked_on: string;
      method: string | null;
      note: string | null;
      animals: { name: string } | null;
    }[]) {
      timeline.push({
        id: `ci-${c.id}`,
        date: c.checked_on,
        kind: "checkin",
        title: `Kontrola péče${c.method ? ` (${METHOD_LABEL[c.method] ?? c.method})` : ""}`,
        detail: [c.animals?.name, c.note].filter(Boolean).join(" · ") || null,
      });
    }
    for (const c of (comms ?? []) as {
      id: string;
      kind: string | null;
      note: string | null;
      created_at: string;
      animals: { name: string } | null;
    }[]) {
      timeline.push({
        id: `co-${c.id}`,
        date: c.created_at.slice(0, 10),
        kind: "comm",
        title: COMM_LABEL[c.kind ?? ""] ?? "Komunikace",
        detail: [c.animals?.name, c.note].filter(Boolean).join(" · ") || null,
      });
    }
    timeline.sort((p, q) => q.date.localeCompare(p.date));
  }

  // --- Proplácení (Náklady source=foster pro umístění pěstouna) -------------
  let reimbursement: ReimbursementVM = { items: [], total: 0 };
  if (placementIds.length) {
    const { data: costs } = await supabase
      .from("animal_costs")
      .select("id, description, amount, spent_on, animals(name)")
      .eq("source", "foster")
      .in("placement_id", placementIds)
      .order("spent_on", { ascending: false });
    const items = ((costs ?? []) as {
      id: string;
      description: string | null;
      amount: number;
      spent_on: string;
      animals: { name: string } | null;
    }[]).map((c) => ({
      id: c.id,
      label: [c.description, c.animals?.name].filter(Boolean).join(" · ") || "Proplaceno",
      amount: c.amount,
    }));
    reimbursement = {
      items,
      total: items.reduce((s, i) => s + i.amount, 0),
    };
  }

  const initial: FosterCarerValues = {
    name: carer.name,
    email: carer.email ?? "",
    phone: carer.phone ?? "",
    address: carer.address ?? "",
    city: carer.city ?? "",
    region: carer.region ?? "",
    capacity: carer.capacity,
    species_note: carer.species_note ?? "",
    notes: carer.notes ?? "",
    is_active: carer.is_active,
    tags: carer.tags ?? [],
    unavailable_until: carer.unavailable_until ?? "",
  };

  return (
    <div className="mx-auto max-w-3xl">
      <CarerDetail
        carerId={id}
        initial={initial}
        meta={{
          email: carer.email,
          phone: carer.phone,
          address: carer.address,
          capacity: carer.capacity,
          activeCount,
          full,
          unavailableUntil: carer.unavailable_until,
        }}
        placements={placements}
        candidates={candidates}
        timeline={timeline}
        reimbursement={reimbursement}
      />
    </div>
  );
}

const METHOD_LABEL: Record<string, string> = {
  phone: "telefon",
  visit: "návštěva",
  message: "zpráva",
};
const COMM_LABEL: Record<string, string> = {
  call: "Telefonát",
  message: "Zpráva",
  email: "E-mail",
};
