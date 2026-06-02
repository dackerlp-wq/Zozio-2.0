import { notFound } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isClosedStatus } from "@/lib/animal-tabs-layout";
import { requiredDocs } from "@/lib/animal-documents";
import type {
  AdoptionStatus,
  AnimalDocumentCategory,
  AnimalDocumentRow,
  AnimalIntakeType,
} from "@/types/database";

import { withSignedUrls } from "../document-data";
import { DocumentsSection } from "../documents-section";

export const metadata = { title: "Dokumenty — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AnimalDocumentsPage({ params }: PageProps) {
  const { id } = await params;
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const { data: owned } = await supabase
    .from("animals")
    .select("id, name, record_number, intake_type, adoption_status")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!owned) notFound();
  const a = owned as {
    name: string;
    record_number: string | null;
    intake_type: AnimalIntakeType | null;
    adoption_status: AdoptionStatus;
  };

  const [{ data }, { count: adoptionCount }] = await Promise.all([
    supabase
      .from("animal_documents")
      .select("*")
      .eq("animal_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("adoptions")
      .select("id", { count: "exact", head: true })
      .eq("animal_id", id)
      .in("stage", ["trial", "finalized"]),
  ]);

  const docs = (data ?? []) as AnimalDocumentRow[];
  const rows = await withSignedUrls(docs);
  const existingCategories = [...new Set(docs.map((d) => d.category))] as AnimalDocumentCategory[];
  const required = requiredDocs(a.intake_type, existingCategories);

  return (
    <DocumentsSection
      animalId={id}
      readOnly={isClosedStatus(a.adoption_status)}
      recordNumber={a.record_number}
      required={required}
      hasAdoption={(adoptionCount ?? 0) > 0}
      rows={rows}
    />
  );
}
