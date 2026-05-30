import { notFound } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  AnimalDocumentRow,
  TreatmentRow,
  VaccinationRow,
  VetRecordRow,
  WeightLogRow,
} from "@/types/database";

import { withSignedUrls } from "../document-data";
import {
  type RecordDoc,
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

  const [weights, vaccinations, treatments, vetRecords, documents] =
    await Promise.all([
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
      supabase
        .from("animal_documents")
        .select("*")
        .eq("animal_id", id)
        .not("related_id", "is", null),
    ]);

  // Propojené dokumenty se signed URL, seskupené podle zdrojového záznamu.
  const signed = await withSignedUrls(
    (documents.data ?? []) as AnimalDocumentRow[],
  );
  const docsByRecord: Record<string, RecordDoc[]> = {};
  for (const d of signed) {
    if (!d.related_id) continue;
    (docsByRecord[d.related_id] ??= []).push({
      id: d.id,
      title: d.title,
      url: d.signed_url,
    });
  }

  return (
    <div className="space-y-6">
      <WeightSection
        animalId={id}
        rows={(weights.data ?? []) as WeightLogRow[]}
      />
      <VaccinationSection
        animalId={id}
        rows={(vaccinations.data ?? []) as VaccinationRow[]}
        docsByRecord={docsByRecord}
      />
      <TreatmentSection
        animalId={id}
        rows={(treatments.data ?? []) as TreatmentRow[]}
        docsByRecord={docsByRecord}
      />
      <VetRecordSection
        animalId={id}
        rows={(vetRecords.data ?? []) as VetRecordRow[]}
        docsByRecord={docsByRecord}
      />
    </div>
  );
}
