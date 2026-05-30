import { notFound } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  AdoptionRow,
  AdoptionStatus,
  AnimalExitRecordRow,
} from "@/types/database";

import {
  AdoptionSection,
  type ApplicationOption,
} from "../adoption-sections";

export const metadata = { title: "Adopce — Zozio Admin" };

const CLOSED: AdoptionStatus[] = ["adopted", "transferred", "deceased"];

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AnimalAdoptionPage({ params }: PageProps) {
  const { id } = await params;
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const { data: animal } = await supabase
    .from("animals")
    .select("id, adoption_status")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!animal) notFound();
  const adoptionStatus = (animal as { adoption_status: AdoptionStatus })
    .adoption_status;

  const [
    { data: inst },
    { data: adoptionData },
    { data: exitData },
    { data: appData },
  ] = await Promise.all([
    supabase
      .from("institutions")
      .select("adoption_fee_default")
      .eq("id", institutionId)
      .maybeSingle(),
    supabase
      .from("adoptions")
      .select("*")
      .eq("animal_id", id)
      .order("started_on", { ascending: false }),
    supabase
      .from("animal_exit_records")
      .select("*")
      .eq("animal_id", id)
      .order("occurred_on", { ascending: false }),
    supabase
      .from("applications")
      .select("id, applicant_name, applicant_email, applicant_phone, status")
      .eq("animal_id", id)
      .in("status", ["approved", "contract_signed"])
      .order("created_at", { ascending: false }),
  ]);

  const feeDefault =
    (inst as { adoption_fee_default: number | null } | null)
      ?.adoption_fee_default ?? null;

  const applications: ApplicationOption[] = (
    (appData ?? []) as {
      id: string;
      applicant_name: string;
      applicant_email: string | null;
      applicant_phone: string | null;
    }[]
  ).map((a) => ({
    id: a.id,
    name: a.applicant_name,
    email: a.applicant_email,
    phone: a.applicant_phone,
  }));

  return (
    <AdoptionSection
      animalId={id}
      isClosed={CLOSED.includes(adoptionStatus)}
      feeDefault={feeDefault}
      applications={applications}
      adoptions={(adoptionData ?? []) as AdoptionRow[]}
      exits={(exitData ?? []) as AnimalExitRecordRow[]}
    />
  );
}
