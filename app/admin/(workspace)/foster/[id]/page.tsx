import { notFound } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FosterCarerRow } from "@/types/database";

import type { FosterCarerValues } from "../actions";
import { CarerDetail, type PlacementRow } from "./carer-detail";

export const metadata = { title: "Pěstoun — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

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
      "id, animal_id, started_on, planned_until, ended_on, end_reason, fee, notes, animals(name)",
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
      animals: { name: string } | null;
    }[]
  ).map((p) => ({
    id: p.id,
    animalId: p.animal_id,
    animalName: p.animals?.name ?? "—",
    started_on: p.started_on,
    planned_until: p.planned_until,
    ended_on: p.ended_on,
    end_reason: p.end_reason,
    fee: p.fee,
    notes: p.notes,
  }));

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
        }}
        placements={placements}
      />
    </div>
  );
}
