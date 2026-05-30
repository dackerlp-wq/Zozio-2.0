"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type {
  AnimalIntakeType,
  AnimalLegalStatus,
} from "@/types/database";

type ActionResult = { error: string } | { ok: true };

export interface IntakeFormValues {
  intake_type: AnimalIntakeType | null;
  intake_date: string; // date | ""
  found_location: string;
  found_date: string;
  announced_at: string;
  handed_over_by: string;
  intake_condition: string;
  // Identifikace
  record_number: string;
  chip_number: string;
  tattoo: string;
  ear_tag: string;
  // Právní stav
  legal_status: AnimalLegalStatus;
  protection_until: string;
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
  const { institutionId } = await requireMembership();
  const service = createServiceClient();

  const { data: owned } = await service
    .from("animals")
    .select("id")
    .eq("id", animalId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!owned) return { error: "Zvíře nepatří tvému útulku." };

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

  const patch = {
    intake_type: values.intake_type,
    intake_date: blank(values.intake_date),
    found_location: blank(values.found_location),
    found_date: blank(values.found_date),
    announced_at: blank(values.announced_at),
    handed_over_by: blank(values.handed_over_by),
    intake_condition: blank(values.intake_condition),
    record_number: blank(values.record_number),
    chip_number: blank(values.chip_number),
    tattoo: blank(values.tattoo),
    ear_tag: blank(values.ear_tag),
    legal_status: values.legal_status,
    protection_until: protectionUntil,
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

  revalidatePath(`/admin/animals/${animalId}/prijem`);
  revalidatePath(`/admin/animals/${animalId}`);
  revalidatePath(`/animals/${animalId}`);
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
  const { institutionId } = await requireMembership();
  const service = createServiceClient();

  const { data: owned } = await service
    .from("animals")
    .select("id")
    .eq("id", animalId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!owned) return { error: "Zvíře nepatří tvému útulku." };

  const patch: { legal_status: AnimalLegalStatus; protection_until?: null } = {
    legal_status: status,
  };
  if (status !== "in_protection") patch.protection_until = null;

  const { error } = await service
    .from("animals")
    .update(patch)
    .eq("id", animalId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/animals/${animalId}/prijem`);
  revalidatePath(`/admin/animals/${animalId}`);
  return { ok: true };
}
