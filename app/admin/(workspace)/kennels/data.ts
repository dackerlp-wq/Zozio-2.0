import "server-only";

import { createClient } from "@/lib/supabase/server";
import { KENNEL_QUARANTINE_KINDS } from "@/lib/format";
import type {
  AdoptionStatus,
  Compatibility,
  KennelRow,
  Sex,
  Species,
} from "@/types/database";

import type { BoardAnimal, BoardKennel } from "./kennel-manager";

export interface KennelSummary {
  capacity: number;
  occupied: number;
  free: number;
  quarantine: number;
  oos: number;
  issues: number;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Problémy kotce — sdíleno mezi nástěnkou a tiskovým přehledem. */
export function kennelConflicts(k: BoardKennel): string[] {
  const out: string[] = [];
  if (k.occupants.length > k.capacity)
    out.push(`Přeplněno (${k.occupants.length}/${k.capacity})`);
  if (k.species_allowed.length > 0) {
    const bad = k.occupants.filter((a) => !k.species_allowed.includes(a.species));
    if (bad.length > 0)
      out.push(`Nepovolený druh: ${bad.map((a) => a.name).join(", ")}`);
  }
  if (k.status !== "active" && k.occupants.length > 0)
    out.push("Obsazený kotec není v provozu");
  const overdue = k.occupants.filter((a) => a.quarantine_overdue);
  if (overdue.length > 0)
    out.push(`Prošlá karanténa: ${overdue.map((a) => a.name).join(", ")}`);
  return out;
}

export function summarize(board: BoardKennel[]): KennelSummary {
  let capacity = 0;
  let occupied = 0;
  let free = 0;
  let quarantine = 0;
  let oos = 0;
  for (const k of board) {
    occupied += k.occupants.length;
    if (k.status === "active") {
      capacity += k.capacity;
      free += Math.max(0, k.capacity - k.occupants.length);
    }
    if (KENNEL_QUARANTINE_KINDS.includes(k.kind)) quarantine += 1;
    if (k.status === "out_of_service") oos += 1;
  }
  const issues = board.filter((k) => kennelConflicts(k).length > 0).length;
  return { capacity, occupied, free, quarantine, oos, issues };
}

/** Načte kotce + obyvatele útulku a sestaví data pro nástěnku/tisk. */
export async function loadKennelBoard(institutionId: string): Promise<{
  board: BoardKennel[];
  unassigned: BoardAnimal[];
}> {
  const supabase = await createClient();

  const [{ data: kennelData }, { data: animalData }, { data: quarData }] =
    await Promise.all([
      supabase
        .from("kennels")
        .select("*")
        .eq("institution_id", institutionId)
        .order("zone", { ascending: true, nullsFirst: true })
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true }),
      supabase
        .from("animals")
        .select(
          "id, name, species, sex, good_with_dogs, good_with_cats, primary_photo_url, adoption_status, kennel_id",
        )
        .eq("institution_id", institutionId)
        .not("adoption_status", "in", "(adopted,transferred,deceased)")
        .order("name", { ascending: true }),
      supabase
        .from("quarantine_records")
        .select("animal_id, planned_until")
        .is("ended_on", null)
        .not("planned_until", "is", null),
    ]);

  const kennels = (kennelData ?? []) as KennelRow[];
  const animals = (animalData ?? []) as {
    id: string;
    name: string;
    species: Species;
    sex: Sex;
    good_with_dogs: Compatibility;
    good_with_cats: Compatibility;
    primary_photo_url: string | null;
    adoption_status: AdoptionStatus;
    kennel_id: string | null;
  }[];

  const today = todayISO();
  const quarUntil = new Map<string, string>();
  for (const q of (quarData ?? []) as {
    animal_id: string;
    planned_until: string;
  }[]) {
    const cur = quarUntil.get(q.animal_id);
    if (!cur || q.planned_until < cur)
      quarUntil.set(q.animal_id, q.planned_until);
  }

  const toBoardAnimal = (a: (typeof animals)[number]): BoardAnimal => {
    const until = quarUntil.get(a.id) ?? null;
    return {
      id: a.id,
      name: a.name,
      species: a.species,
      sex: a.sex,
      good_with_dogs: a.good_with_dogs,
      good_with_cats: a.good_with_cats,
      photo: a.primary_photo_url,
      adoption_status: a.adoption_status,
      quarantine_until: until,
      quarantine_overdue: !!until && until < today,
    };
  };

  const byKennel = new Map<string, BoardAnimal[]>();
  const unassigned: BoardAnimal[] = [];
  for (const a of animals) {
    if (!a.kennel_id) {
      unassigned.push(toBoardAnimal(a));
      continue;
    }
    const list = byKennel.get(a.kennel_id) ?? [];
    list.push(toBoardAnimal(a));
    byKennel.set(a.kennel_id, list);
  }

  const board: BoardKennel[] = kennels.map((k) => ({
    id: k.id,
    name: k.name,
    zone: k.zone,
    kind: k.kind,
    status: k.status,
    capacity: k.capacity,
    species_allowed: k.species_allowed ?? [],
    notes: k.notes,
    is_heated: k.is_heated,
    is_accessible: k.is_accessible,
    is_maternity: k.is_maternity,
    photo_url: k.photo_url,
    out_of_service_reason: k.out_of_service_reason,
    out_of_service_until: k.out_of_service_until,
    occupants: byKennel.get(k.id) ?? [],
  }));

  return { board, unassigned };
}
