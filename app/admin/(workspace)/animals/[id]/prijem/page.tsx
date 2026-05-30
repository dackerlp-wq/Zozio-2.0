import { notFound } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AnimalRow } from "@/types/database";

import { IntakeForm } from "../intake-form";
import type { IntakeFormValues } from "../intake-actions";

export const metadata = { title: "Příjem & právní stav — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AnimalIntakePage({ params }: PageProps) {
  const { id } = await params;
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const { data } = await supabase
    .from("animals")
    .select("*")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!data) notFound();
  const a = data as AnimalRow;

  const initial: IntakeFormValues = {
    intake_type: a.intake_type,
    intake_date: a.intake_date ?? "",
    found_location: a.found_location ?? "",
    found_date: a.found_date ?? "",
    announced_at: a.announced_at ?? "",
    handed_over_by: a.handed_over_by ?? "",
    intake_condition: a.intake_condition ?? "",
    record_number: a.record_number ?? "",
    chip_number: a.chip_number ?? "",
    tattoo: a.tattoo ?? "",
    ear_tag: a.ear_tag ?? "",
    legal_status: a.legal_status,
    protection_until: a.protection_until ?? "",
    original_owner: a.original_owner ?? "",
    surrender_waiver_at: a.surrender_waiver_at ?? "",
    surrender_waiver_url: a.surrender_waiver_url ?? "",
  };

  return <IntakeForm animalId={id} initial={initial} />;
}
