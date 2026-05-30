import { notFound } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AnimalCostRow, AnimalIncidentRow } from "@/types/database";

import { EvidenceSection } from "../evidence-sections";

export const metadata = { title: "Náklady & události — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AnimalEvidencePage({ params }: PageProps) {
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

  const [{ data: costData }, { data: incidentData }] = await Promise.all([
    supabase
      .from("animal_costs")
      .select("*")
      .eq("animal_id", id)
      .order("spent_on", { ascending: false }),
    supabase
      .from("animal_incidents")
      .select("*")
      .eq("animal_id", id)
      .order("occurred_on", { ascending: false }),
  ]);

  return (
    <EvidenceSection
      animalId={id}
      costs={(costData ?? []) as AnimalCostRow[]}
      incidents={(incidentData ?? []) as AnimalIncidentRow[]}
    />
  );
}
