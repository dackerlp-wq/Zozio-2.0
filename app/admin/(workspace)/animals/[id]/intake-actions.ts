"use server";

import { revalidatePath } from "next/cache";

import { requireMembership, ensurePermission } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAnimalFieldChanges } from "@/lib/animal-history";
import type {
  AdoptionStatus,
  AnimalIntakeType,
  AnimalLegalStatus,
  AnimalVetCareNeed,
  ChipCheckResult,
} from "@/types/database";
import { maybeAutoPublish } from "../actions";

type ActionResult = { error: string } | { ok: true };

export interface IntakeFormValues {
  intake_type: AnimalIntakeType | null;
  intake_date: string; // date | ""
  intake_time: string; // time | ""
  found_location: string;
  found_date: string;
  announced_at: string;
  found_lat: number | null;
  found_lng: number | null;
  handed_over_by: string;
  handed_over_phone: string;
  handed_over_email: string;
  intake_condition: string;
  // Identifikace
  record_number: string;
  chip_number: string;
  tattoo: string;
  ear_tag: string;
  identification_none: boolean;
  // Veterinární péče & dohled při příjmu
  vet_care_need: AnimalVetCareNeed | null;
  intake_quarantine_days: number | null;
  // Personál & evidence
  intake_staff: string;
  intake_staff_role: string;
  intake_notes: string;
  municipality_ref: string;
  registry_name: string;
  // Zdroj dle způsobu příjmu
  source_institution: string;
  confiscation_authority: string;
  confiscation_ref: string;
  // Ověření čipu v registru
  chip_checked_at: string;
  chip_check_result: ChipCheckResult | null;
  // Hlášení KVS
  kvs_reported_at: string;
  // Právní stav
  legal_status: AnimalLegalStatus;
  protection_until: string;
  found_listing_published: boolean;
  original_owner: string;
  surrender_waiver_at: string;
  surrender_waiver_url: string;
}

function blank(v: string): string | null {
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/** Přičte k datu (YYYY-MM-DD) počet měsíců a vrátí YYYY-MM-DD. */
function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/**
 * Vygeneruje další interní evidenční číslo ve formátu `RRRR/NNNN`
 * v rámci instituce pro aktuální rok. Vrací návrh, neukládá.
 */
export async function suggestRecordNumber(): Promise<
  { ok: true; value: string } | { error: string }
> {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();

  const year = new Date().getFullYear();
  const prefix = `${year}/`;

  const { data, error } = await service
    .from("animals")
    .select("record_number")
    .eq("institution_id", institutionId)
    .ilike("record_number", `${prefix}%`);

  if (error) return { error: error.message };

  let max = 0;
  for (const row of data ?? []) {
    const rn = (row as { record_number: string | null }).record_number;
    if (!rn || !rn.startsWith(prefix)) continue;
    const n = parseInt(rn.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }

  const next = String(max + 1).padStart(4, "0");
  return { ok: true, value: `${prefix}${next}` };
}

/**
 * Uloží příjmové a právní údaje zvířete. Pokud je vybrán stav
 * „v ochranné lhůtě" a `protection_until` není vyplněno, dopočítá ho
 * z data vyhlášení (announced_at) nebo data nálezu + nastavení útulku.
 */
export async function saveIntake(
  animalId: string,
  values: IntakeFormValues,
): Promise<ActionResult> {
  const __perm = await ensurePermission("animals_edit");
  if (!__perm.ok) return { error: __perm.error };
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();

  const { data: before } = await service
    .from("animals")
    .select("*")
    .eq("id", animalId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!before) return { error: "Zvíře nepatří tvému útulku." };

  // Doplň délku ochranné lhůty z nastavení útulku, pokud chybí datum.
  let protectionUntil = blank(values.protection_until);
  if (values.legal_status === "in_protection" && !protectionUntil) {
    const base = blank(values.announced_at) ?? blank(values.found_date);
    if (base) {
      const { data: inst } = await service
        .from("institutions")
        .select("protection_period_months")
        .eq("id", institutionId)
        .maybeSingle();
      const months =
        (inst as { protection_period_months: number } | null)
          ?.protection_period_months ?? 4;
      protectionUntil = addMonths(base, months);
    }
  }
  // Mimo ochrannou lhůtu nemá smysl datum konce držet.
  if (values.legal_status !== "in_protection") {
    protectionUntil = null;
  }

  // Katalog nalezenců: zveřejnit lze jen nalezené/odebrané zvíře v ochranné
  // lhůtě. Jakmile lhůta skončí (vlastnictví vyřešeno), příznak zhasne.
  const foundEligible =
    values.legal_status === "in_protection" &&
    (values.intake_type === "found" || values.intake_type === "confiscation");
  const foundListing = foundEligible && values.found_listing_published;

  const patch = {
    intake_type: values.intake_type,
    intake_date: blank(values.intake_date),
    intake_time: blank(values.intake_time),
    found_location: blank(values.found_location),
    found_date: blank(values.found_date),
    announced_at: blank(values.announced_at),
    found_lat: values.found_lat,
    found_lng: values.found_lng,
    handed_over_by: blank(values.handed_over_by),
    handed_over_phone: blank(values.handed_over_phone),
    handed_over_email: blank(values.handed_over_email),
    intake_condition: blank(values.intake_condition),
    record_number: blank(values.record_number),
    chip_number: blank(values.chip_number),
    tattoo: blank(values.tattoo),
    ear_tag: blank(values.ear_tag),
    identification_none: values.identification_none,
    // Čipování se odvodí z identifikace: vyplněný čip = potvrzeno čipováno,
    // „bez identifikace" = nečipováno, jinak neznámo.
    is_chipped: values.identification_none
      ? false
      : blank(values.chip_number)
        ? true
        : null,
    vet_care_need: values.vet_care_need,
    intake_quarantine_days: values.intake_quarantine_days,
    intake_staff: blank(values.intake_staff),
    intake_staff_role: blank(values.intake_staff_role),
    intake_notes: blank(values.intake_notes),
    municipality_ref: blank(values.municipality_ref),
    registry_name: blank(values.registry_name),
    source_institution: blank(values.source_institution),
    confiscation_authority: blank(values.confiscation_authority),
    confiscation_ref: blank(values.confiscation_ref),
    chip_checked_at: blank(values.chip_checked_at),
    chip_check_result: values.chip_check_result,
    kvs_reported_at: blank(values.kvs_reported_at),
    legal_status: values.legal_status,
    protection_until: protectionUntil,
    found_listing_published: foundListing,
    original_owner: blank(values.original_owner),
    surrender_waiver_at: blank(values.surrender_waiver_at),
    surrender_waiver_url: blank(values.surrender_waiver_url),
  };

  const { error } = await service
    .from("animals")
    .update(patch)
    .eq("id", animalId);

  if (error) {
    // Unikátní evidenční číslo v rámci instituce.
    if (error.code === "23505") {
      return { error: "Toto evidenční číslo už v útulku existuje." };
    }
    return { error: error.message };
  }

  // Auditní historie změn příjmových a právních polí.
  await logAnimalFieldChanges(service, {
    animalId,
    institutionId,
    changedBy: user.id,
    before: before as Record<string, unknown>,
    after: patch,
  });

  // Vyplněný příjem může zvíře posunout k automatickému zveřejnění.
  await maybeAutoPublish(animalId, user.id);

  revalidatePath(`/admin/animals/${animalId}/prijem`);
  revalidatePath(`/admin/animals/${animalId}`);
  revalidatePath(`/admin/animals/${animalId}/historie`);
  revalidatePath(`/animals/${animalId}`);
  revalidatePath("/nalezenci");
  revalidatePath(`/nalezenci/${animalId}`);
  return { ok: true };
}

/**
 * Rychlá změna jen právního stavu (např. ukončení ochranné lhůty,
 * přihlášení původního majitele). Při převodu na „ve vlastnictví útulku"
 * vyčistí datum konce ochranné lhůty.
 */
export async function setLegalStatus(
  animalId: string,
  status: AnimalLegalStatus,
): Promise<ActionResult> {
  const __perm = await ensurePermission("animals_edit");
  if (!__perm.ok) return { error: __perm.error };
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();

  const { data: before } = await service
    .from("animals")
    .select("legal_status, protection_until, adoption_status")
    .eq("id", animalId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!before) return { error: "Zvíře nepatří tvému útulku." };

  const prevAdoption = (before as { adoption_status: AdoptionStatus })
    .adoption_status;

  const patch: {
    legal_status: AnimalLegalStatus;
    protection_until?: null;
    found_listing_published?: false;
    adoption_status?: AdoptionStatus;
  } = {
    legal_status: status,
  };
  // Po skončení ochranné lhůty zvíře z katalogu nalezenců zmizí.
  if (status !== "in_protection") {
    patch.protection_until = null;
    patch.found_listing_published = false;
  }

  // Provázání os: přihlásil-li se původní majitel, zvíře opouští útulek
  // (výstup typu „vrácení") a životní cyklus přechází na „Vráceno".
  const ownerClaimed =
    status === "owner_claimed" && prevAdoption !== "returned";
  if (ownerClaimed) {
    patch.adoption_status = "returned";
  }

  const { error } = await service
    .from("animals")
    .update(patch)
    .eq("id", animalId);
  if (error) return { error: error.message };

  if (ownerClaimed) {
    await service.from("animal_exit_records").insert({
      animal_id: animalId,
      institution_id: institutionId,
      kind: "return",
      occurred_on: new Date().toISOString().slice(0, 10),
      reason: "Přihlásil se původní majitel",
      created_by: user.id,
    });
    await service.from("animal_status_events").insert({
      animal_id: animalId,
      from_status: prevAdoption,
      to_status: "returned",
      note: "Přihlásil se původní majitel — zvíře vráceno majiteli",
      changed_by: user.id,
    });
  }

  // Auditní historie změny právního stavu.
  await logAnimalFieldChanges(service, {
    animalId,
    institutionId,
    changedBy: user.id,
    before: before as Record<string, unknown>,
    after: patch,
  });

  // Změna právního stavu (typicky převod do vlastnictví útulku) může
  // umožnit automatické zveřejnění.
  await maybeAutoPublish(animalId, user.id);

  revalidatePath(`/admin/animals/${animalId}/prijem`);
  revalidatePath(`/admin/animals/${animalId}`);
  revalidatePath(`/admin/animals/${animalId}/historie`);
  revalidatePath("/nalezenci");
  revalidatePath(`/nalezenci/${animalId}`);
  return { ok: true };
}
