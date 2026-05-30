import { notFound } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  TreatmentRow,
  VaccinationRow,
  VetRecordRow,
  WeightLogRow,
} from "@/types/database";

import {
  TreatmentSection,
  VaccinationSection,
  VetRecordSection,
  WeightSection,
} from "../health-sections";

export const metadata = { title: "Zdraví — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AnimalHealthPage({ params }: PageProps) {
  const { id } = await params;
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const { data: owned } = await supabase
    .from("animals")
    .select("id")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!owned) notFound();

  const [weights, vaccinations, treatments, vetRecords] = await Promise.all([
    supabase
      .from("weight_logs")
      .select("*")
      .eq("animal_id", id)
      .order("measured_at", { ascending: false }),
    supabase
      .from("vaccinations")
      .select("*")
      .eq("animal_id", id)
      .order("administered_at", { ascending: false }),
    supabase
      .from("treatments")
      .select("*")
      .eq("animal_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("vet_records")
      .select("*")
      .eq("animal_id", id)
      .order("recorded_at", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <WeightSection
        animalId={id}
        rows={(weights.data ?? []) as WeightLogRow[]}
      />
      <VaccinationSection
        animalId={id}
        rows={(vaccinations.data ?? []) as VaccinationRow[]}
      />
      <TreatmentSection
        animalId={id}
        rows={(treatments.data ?? []) as TreatmentRow[]}
      />
      <VetRecordSection
        animalId={id}
        rows={(vetRecords.data ?? []) as VetRecordRow[]}
      />
    </div>
  );
}
