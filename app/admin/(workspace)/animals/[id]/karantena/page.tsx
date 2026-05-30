import { notFound } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  AnimalSupervisionStatus,
  QuarantineRecordRow,
} from "@/types/database";

import { QuarantineSection } from "../quarantine-sections";

export const metadata = { title: "Karanténa — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AnimalQuarantinePage({ params }: PageProps) {
  const { id } = await params;
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const { data: animal } = await supabase
    .from("animals")
    .select("id, supervision_status")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!animal) notFound();

  const { data: records } = await supabase
    .from("quarantine_records")
    .select("*")
    .eq("animal_id", id)
    .order("started_on", { ascending: false });

  return (
    <QuarantineSection
      animalId={id}
      current={
        (animal as { supervision_status: AnimalSupervisionStatus })
          .supervision_status
      }
      records={(records ?? []) as QuarantineRecordRow[]}
    />
  );
}
