import { notFound } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { READINESS_SELECT, type ReadinessInput } from "@/lib/animal-readiness";
import { isTreatmentActive } from "@/lib/animal-health";
import { scoreApplication, type AnimalAdoptionNeeds } from "@/lib/animal-adoption-match";
import { createClient } from "@/lib/supabase/server";
import type {
  AdopterExperience,
  AdoptionCheckinRow,
  AdoptionCommunicationRow,
  AdoptionRow,
  AdoptionStatus,
  AnimalExitRecordRow,
  CareDifficulty,
  Compatibility,
  SuitableHousing,
} from "@/types/database";

import {
  AdoptionSection,
  type ApplicationVM,
  type CheckinVM,
  type CommunicationVM,
} from "../adoption-sections";
import { LockedTabNotice } from "../locked-tab-notice";

export const metadata = { title: "Adopce — Zozio Admin" };

const CLOSED: AdoptionStatus[] = ["adopted", "transferred", "deceased"];

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AnimalAdoptionPage({ params }: PageProps) {
  const { id } = await params;
  const { institutionId, role } = await requireMembership();
  const supabase = await createClient();

  const { data: animal } = await supabase
    .from("animals")
    .select(
      `id, adoption_status, protection_until, good_with_children, good_with_dogs, good_with_cats, needs_garden, suitable_housing, adopter_experience, care_difficulty, ${READINESS_SELECT}`,
    )
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!animal) notFound();
  const a = animal as {
    adoption_status: AdoptionStatus;
    protection_until: string | null;
    good_with_children: Compatibility;
    good_with_dogs: Compatibility;
    good_with_cats: Compatibility;
    needs_garden: boolean | null;
    suitable_housing: SuitableHousing | null;
    adopter_experience: AdopterExperience;
    care_difficulty: CareDifficulty | null;
  } & ReadinessInput;
  const adoptionStatus = a.adoption_status;

  // Zámek: v ochranné lhůtě nelze adopci zahájit — záložka je jen důvod + odkaz.
  if (a.legal_status === "in_protection") {
    return (
      <LockedTabNotice
        animalId={id}
        reason="Probíhá ochranná lhůta — adopci nelze zahájit, dokud lhůta neskončí. Nejdřív zvíře převeď do vlastnictví útulku na záložce Příjem & právo."
        unlockTab="prijem"
      />
    );
  }

  const readiness: ReadinessInput = {
    intake_type: a.intake_type,
    intake_date: a.intake_date,
    found_date: a.found_date,
    supervision_status: a.supervision_status,
    legal_status: a.legal_status,
    chip_number: a.chip_number,
    tattoo: a.tattoo,
    ear_tag: a.ear_tag,
    identification_none: a.identification_none,
    primary_photo_url: a.primary_photo_url,
    is_vaccinated: a.is_vaccinated,
    published_at: a.published_at,
  };

  const [
    { data: inst },
    { data: adoptionData },
    { data: exitData },
    { data: appData },
    { data: checkinData },
    { data: commData },
    { data: treatData },
    { count: condCount },
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
      .select(
        "id, applicant_name, applicant_email, applicant_phone, applicant_city, applicant_data, status, created_at",
      )
      .eq("animal_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("adoption_checkins")
      .select("*")
      .eq("animal_id", id)
      .order("checked_on", { ascending: false }),
    supabase
      .from("adoption_communications")
      .select("*")
      .eq("animal_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("treatments").select("start_date, end_date").eq("animal_id", id),
    supabase
      .from("animal_conditions")
      .select("id", { count: "exact", head: true })
      .eq("animal_id", id),
  ]);

  const feeDefault =
    (inst as { adoption_fee_default: number | null } | null)
      ?.adoption_fee_default ?? null;

  // Požadavky zvířete pro skríning žádostí.
  const hasActiveMed = ((treatData ?? []) as { start_date: string | null; end_date: string | null }[]).some(
    (t) => isTreatmentActive(t),
  );
  const needs: AnimalAdoptionNeeds = {
    good_with_children: a.good_with_children,
    good_with_dogs: a.good_with_dogs,
    good_with_cats: a.good_with_cats,
    needs_garden: a.needs_garden,
    suitable_housing: a.suitable_housing,
    adopter_experience: a.adopter_experience,
    care_difficulty: a.care_difficulty,
    hasSpecialNeeds: hasActiveMed || (condCount ?? 0) > 0,
  };

  const applications: ApplicationVM[] = (
    (appData ?? []) as {
      id: string;
      applicant_name: string;
      applicant_email: string | null;
      applicant_phone: string | null;
      applicant_city: string | null;
      applicant_data: unknown;
      status: ApplicationVM["status"];
      created_at: string;
    }[]
  ).map((app) => ({
    id: app.id,
    name: app.applicant_name,
    email: app.applicant_email,
    phone: app.applicant_phone,
    city: app.applicant_city,
    status: app.status,
    createdAt: app.created_at,
    match: scoreApplication(app.applicant_data, needs),
  }));

  const checkins: CheckinVM[] = ((checkinData ?? []) as AdoptionCheckinRow[]).map((c) => ({
    id: c.id,
    adoptionId: c.adoption_id,
    kind: c.kind,
    date: c.checked_on,
    method: c.method,
    note: c.note,
    photos: c.photos ?? [],
  }));

  const communications: CommunicationVM[] = (
    (commData ?? []) as AdoptionCommunicationRow[]
  ).map((c) => ({
    id: c.id,
    adoptionId: c.adoption_id,
    at: c.created_at,
    kind: c.kind,
    note: c.note,
  }));

  return (
    <AdoptionSection
      animalId={id}
      isClosed={CLOSED.includes(adoptionStatus)}
      feeDefault={feeDefault}
      applications={applications}
      adoptions={(adoptionData ?? []) as AdoptionRow[]}
      exits={(exitData ?? []) as AnimalExitRecordRow[]}
      checkins={checkins}
      communications={communications}
      role={role}
      readiness={readiness}
      protectionUntil={a.protection_until}
    />
  );
}
