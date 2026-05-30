import { notFound } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AnimalDocumentRow } from "@/types/database";

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
    .select("id")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!owned) notFound();

  const { data } = await supabase
    .from("animal_documents")
    .select("*")
    .eq("animal_id", id)
    .order("created_at", { ascending: false });

  const rows = await withSignedUrls((data ?? []) as AnimalDocumentRow[]);

  return <DocumentsSection animalId={id} rows={rows} />;
}
