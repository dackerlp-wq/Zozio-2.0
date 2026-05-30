import { notFound } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import {
  FosterSection,
  type CarerOption,
  type PlacementItem,
} from "../foster-sections";

export const metadata = { title: "Pěstoun — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AnimalFosterPage({ params }: PageProps) {
  const { id } = await params;
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const { data: animal } = await supabase
    .from("animals")
    .select("id")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!animal) notFound();

  const { data: inst } = await supabase
    .from("institutions")
    .select("foster_fee_enabled")
    .eq("id", institutionId)
    .maybeSingle();
  const feeEnabled =
    (inst as { foster_fee_enabled: boolean | null } | null)?.foster_fee_enabled ??
    false;

  const [{ data: carerData }, { data: placementData }] = await Promise.all([
    supabase
      .from("foster_carers")
      .select("id, name")
      .eq("institution_id", institutionId)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("foster_placements")
      .select(
        "id, carer_id, started_on, planned_until, ended_on, end_reason, fee, contract_signed_at, contract_url, notes, foster_carers(name)",
      )
      .eq("animal_id", id)
      .order("started_on", { ascending: false }),
  ]);

  const carers = ((carerData ?? []) as { id: string; name: string }[]).map(
    (c): CarerOption => ({ id: c.id, name: c.name }),
  );

  const placements: PlacementItem[] = (
    (placementData ?? []) as {
      id: string;
      carer_id: string;
      started_on: string;
      planned_until: string | null;
      ended_on: string | null;
      end_reason: string | null;
      fee: number | null;
      contract_signed_at: string | null;
      contract_url: string | null;
      notes: string | null;
      foster_carers: { name: string } | null;
    }[]
  ).map((p) => ({
    id: p.id,
    carerId: p.carer_id,
    carerName: p.foster_carers?.name ?? "—",
    started_on: p.started_on,
    planned_until: p.planned_until,
    ended_on: p.ended_on,
    end_reason: p.end_reason,
    fee: p.fee,
    contract_signed_at: p.contract_signed_at,
    contract_url: p.contract_url,
    notes: p.notes,
  }));

  return (
    <FosterSection
      animalId={id}
      carers={carers}
      feeEnabled={feeEnabled}
      placements={placements}
    />
  );
}
