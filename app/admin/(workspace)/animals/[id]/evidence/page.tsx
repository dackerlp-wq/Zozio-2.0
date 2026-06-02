import { notFound } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isClosedStatus } from "@/lib/animal-tabs-layout";
import type {
  AdoptionStatus,
  AnimalCostRow,
  AnimalDonationRow,
} from "@/types/database";

import { EvidenceSection, type AdoptionFeeVM } from "../evidence-sections";

export const metadata = { title: "Náklady — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AnimalEvidencePage({ params }: PageProps) {
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
  const adoptionStatus = (animal as { adoption_status: AdoptionStatus }).adoption_status;

  const [{ data: costData }, { data: donationData }, { data: adoptionData }] =
    await Promise.all([
      supabase
        .from("animal_costs")
        .select("*")
        .eq("animal_id", id)
        .order("spent_on", { ascending: false }),
      supabase
        .from("animal_donations")
        .select("*")
        .eq("animal_id", id)
        .order("occurred_on", { ascending: false }),
      supabase
        .from("adoptions")
        .select("fee, fee_paid_at, stage")
        .eq("animal_id", id)
        .in("stage", ["trial", "finalized"])
        .order("started_on", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const ad = adoptionData as { fee: number | null; fee_paid_at: string | null; stage: string } | null;
  const adoptionFee: AdoptionFeeVM | null =
    ad && ad.fee != null && ad.fee > 0
      ? { amount: ad.fee, paid: ad.fee_paid_at !== null, paidAt: ad.fee_paid_at }
      : null;

  return (
    <EvidenceSection
      animalId={id}
      readOnly={isClosedStatus(adoptionStatus)}
      costs={(costData ?? []) as AnimalCostRow[]}
      donations={(donationData ?? []) as AnimalDonationRow[]}
      adoptionFee={adoptionFee}
    />
  );
}
