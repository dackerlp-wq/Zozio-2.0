"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { logAnimalFieldChanges } from "@/lib/animal-history";
import { resolveBirthDate } from "@/lib/animal-age";
import {
  ADOPTION_OUTCOME_STATUSES,
  DERIVED_ADOPTION_STATUSES,
  DERIVED_STATUS_SOURCE,
  PUBLIC_ADOPTION_STATUSES,
} from "@/lib/format";
import {
  blockerMessage,
  blockers,
  evaluateReadiness,
  publishReadiness,
  READINESS_SELECT,
  type ReadinessInput,
} from "@/lib/animal-readiness";
import { intakeDefaults } from "@/lib/animal-intake";
import type {
  AdoptionStatus,
  AnimalIntakeType,
  AnimalLegalStatus,
  AnimalSupervisionStatus,
  AnimalVetCareNeed,
  AnimalSize,
  CareDifficulty,
  Compatibility,
  EnergyLevel,
  HealthStatus,
  Sex,
  Species,
  SuitableHousing,
} from "@/types/database";

export interface AnimalFormValues {
  name: string;
  species: Species;
  breed: string;
  is_crossbreed: boolean;
  breed_secondary: string;
  primary_photo_url: string;
  gallery: string[];
  description: string;
  age_years: number | null;
  age_months: number | null;
  // Přesné datum narození (pokud známo) — má přednost před věkem.
  date_of_birth: string;
  sex: Sex;
  size: AnimalSize | null;
  color: string;
  weight_kg: number | null;
  is_neutered: boolean | null;
  is_vaccinated: boolean;
  is_chipped: boolean | null;
  health_status: HealthStatus;
  health_notes: string;
  good_with_children: Compatibility;
  good_with_dogs: Compatibility;
  good_with_cats: Compatibility;
  energy_level: EnergyLevel | null;
  care_difficulty: CareDifficulty | null;
  suitable_housing: SuitableHousing | null;
  personality_tags: string[];
  story_title: string;
  story_text: string;
  adoption_status: AdoptionStatus;
  is_urgent: boolean;
  // Příjem & právní stav — vyplňují se jen při vytváření zvířete.
  // Při editaci profilu se tato pole spravují na záložce „Příjem".
  intake_type: AnimalIntakeType | null;
  intake_date: string;
  intake_time: string;
  found_location: string;
  found_date: string;
  announced_at: string;
  found_lat: number | null;
  found_lng: number | null;
  handed_over_by: string;
  handed_over_phone: string;
  handed_over_email: string;
  intake_condition: string;
  record_number: string;
  // Identifikace
  chip_number: string;
  tattoo: string;
  ear_tag: string;
  identification_none: boolean;
  // Veterinární péče & dohled při příjmu
  vet_care_need: AnimalVetCareNeed | null;
  supervision_status: AnimalSupervisionStatus;
  intake_quarantine_days: number | null;
  // Umístění
  kennel_id: string | null;
  // Personál & poznámky
  intake_staff: string;
  intake_notes: string;
  // Nepovinné registry
  municipality_ref: string;
  registry_name: string;
  // Automatické zveřejnění
  auto_publish: boolean;
  // Právní stav
  legal_status: AnimalLegalStatus;
  protection_until: string;
}

function toRow(v: AnimalFormValues, institutionId: string, anchorDate: string) {
  const birth = resolveBirthDate({
    dob: blank(v.date_of_birth),
    ageYears: v.age_years,
    ageMonths: v.age_months,
    anchorDate,
  });
  return {
    institution_id: institutionId,
    name: v.name.trim(),
    species: v.species,
    breed: v.breed.trim() || null,
    is_crossbreed: v.is_crossbreed,
    breed_secondary: v.breed_secondary.trim() || null,
    primary_photo_url: v.primary_photo_url || null,
    gallery: v.gallery,
    description: v.description.trim() || null,
    age_years: v.age_years,
    age_months: v.age_months,
    birth_date: birth.birth_date,
    birth_date_is_estimate: birth.birth_date_is_estimate,
    sex: v.sex,
    size: v.size,
    color: v.color.trim() || null,
    weight_kg: v.weight_kg,
    is_neutered: v.is_neutered,
    is_vaccinated: v.is_vaccinated,
    is_chipped: v.is_chipped,
    health_status: v.health_status,
    health_notes: v.health_notes.trim() || null,
    good_with_children: v.good_with_children,
    good_with_dogs: v.good_with_dogs,
    good_with_cats: v.good_with_cats,
    energy_level: v.energy_level,
    care_difficulty: v.care_difficulty,
    suitable_housing: v.suitable_housing,
    personality_tags: v.personality_tags,
    story_title: v.story_title.trim() || null,
    story_text: v.story_text.trim() || null,
    adoption_status: v.adoption_status,
    is_urgent: v.is_urgent,
  };
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
 * Sestaví příjmová a právní pole z formuláře a dopočítá konec ochranné
 * lhůty (z data vyhlášení/nálezu + nastavení útulku), pokud chybí.
 * Stejná logika jako v `saveIntake` na záložce Příjem.
 */
async function intakeRow(
  v: AnimalFormValues,
  institutionId: string,
  service: ReturnType<typeof createServiceClient>,
) {
  let protectionUntil = blank(v.protection_until);
  if (v.legal_status === "in_protection" && !protectionUntil) {
    const base = blank(v.announced_at) ?? blank(v.found_date);
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
  if (v.legal_status !== "in_protection") protectionUntil = null;

  return {
    intake_type: v.intake_type,
    intake_date: blank(v.intake_date),
    intake_time: blank(v.intake_time),
    found_location: blank(v.found_location),
    found_date: blank(v.found_date),
    announced_at: blank(v.announced_at),
    found_lat: v.found_lat,
    found_lng: v.found_lng,
    handed_over_by: blank(v.handed_over_by),
    handed_over_phone: blank(v.handed_over_phone),
    handed_over_email: blank(v.handed_over_email),
    intake_condition: blank(v.intake_condition),
    record_number: blank(v.record_number),
    // Identifikace
    chip_number: blank(v.chip_number),
    tattoo: blank(v.tattoo),
    ear_tag: blank(v.ear_tag),
    identification_none: v.identification_none,
    is_chipped: v.identification_none ? false : blank(v.chip_number) ? true : null,
    // Veterinární péče při příjmu
    vet_care_need: v.vet_care_need,
    intake_quarantine_days: v.intake_quarantine_days,
    // Personál & poznámky
    intake_staff: blank(v.intake_staff),
    intake_notes: blank(v.intake_notes),
    // Nepovinné registry
    municipality_ref: blank(v.municipality_ref),
    registry_name: blank(v.registry_name),
    auto_publish: v.auto_publish,
    legal_status: v.legal_status,
    protection_until: protectionUntil,
  };
}

/** Přičte k datu (YYYY-MM-DD) počet dní a vrátí YYYY-MM-DD. */
function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Automatické zveřejnění. Pokud má zvíře zapnuté `auto_publish`, je ve stavu
 * „příjem"/„nezveřejněno" a projde tvrdými body hradla „publish" (vyplněný
 * příjem + uzavřená karanténa), přepne se na „K adopci" a nastaví se
 * `published_at`. Zapíše auditní událost. Vrací true při zveřejnění.
 *
 * Pozn.: Právní stav (ochranná lhůta) zveřejnění nebrání — během lhůty se
 * zvíře smí inzerovat (dle nastavení útulku), jen je blokovaný adopční
 * formulář. Trvalou adopci pak hlídá hradlo `adopt_finalize`.
 */
export async function maybeAutoPublish(
  animalId: string,
  changedBy: string | null,
): Promise<boolean> {
  const service = createServiceClient();
  const { data } = await service
    .from("animals")
    .select(
      `id, adoption_status, auto_publish, published_at, ${READINESS_SELECT}`,
    )
    .eq("id", animalId)
    .maybeSingle();
  if (!data) return false;

  const a = data as Record<string, unknown>;
  if (a.auto_publish !== true) return false;
  // Ochranná lhůta = zvíře se NIKDY nepublikuje k adopci. Jediná veřejná
  // prezentace je katalog nalezenců (found_listing_published), který má
  // vlastní přepínač. Adopční stav zůstává „příjem".
  if (a.legal_status === "in_protection") return false;
  const status = a.adoption_status as AdoptionStatus;
  if (status !== "intake" && status !== "unpublished") return false;

  const { ready } = publishReadiness(a as unknown as ReadinessInput);
  if (!ready) return false;

  const patch: { adoption_status: AdoptionStatus; published_at?: string } = {
    adoption_status: "available",
  };
  if (!a.published_at) patch.published_at = new Date().toISOString();

  const { error } = await service
    .from("animals")
    .update(patch)
    .eq("id", animalId);
  if (error) return false;

  await service.from("animal_status_events").insert({
    animal_id: animalId,
    from_status: status,
    to_status: "available",
    note: "[AUTOMATICKÉ ZVEŘEJNĚNÍ] Splněna připravenost (příjem + karanténa).",
    changed_by: changedBy,
  });

  revalidatePath("/admin/animals");
  revalidatePath(`/admin/animals/${animalId}`);
  revalidatePath(`/animals/${animalId}`);
  return true;
}

export async function createAnimal(values: AnimalFormValues) {
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();

  const intake = await intakeRow(values, institutionId, service);

  // Režim dohledu řídí formulář (předvyplněný podle způsobu příjmu, lze přepsat).
  const supervision: AnimalSupervisionStatus =
    values.supervision_status ??
    intakeDefaults(values.intake_type).supervision_status;

  // Ověř, že vybraný kotec patří útulku.
  let kennelId = values.kennel_id;
  if (kennelId) {
    const { data: kennel } = await service
      .from("kennels")
      .select("id")
      .eq("id", kennelId)
      .eq("institution_id", institutionId)
      .maybeSingle();
    if (!kennel) return { error: "Vybraný kotec nepatří tvému útulku." };
  }

  // Nově přijaté zvíře vždy začíná ve stavu „Příjem" a NEzveřejňuje se.
  // Na web (available) ho útulek pustí až po vyřešení práva a karantény.
  const { data, error } = await service
    .from("animals")
    .insert({
      ...toRow(
        values,
        institutionId,
        blank(values.intake_date) ?? new Date().toISOString().slice(0, 10),
      ),
      ...intake,
      adoption_status: "intake",
      supervision_status: supervision,
      kennel_id: kennelId,
      published_at: null,
    })
    .select("id")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      return { error: "Toto evidenční číslo už v útulku existuje." };
    }
    return { error: error?.message ?? "Zvíře se nepodařilo vytvořit." };
  }

  const animalId = (data as { id: string }).id;

  // Propojení s modulem Ustájení — historie umístění do kotce.
  if (kennelId) {
    await service.from("kennel_assignments").insert({
      animal_id: animalId,
      kennel_id: kennelId,
      moved_in_at: new Date().toISOString(),
      note: "Umístění při příjmu",
      created_by: user.id,
    });
  }

  // Propojení s modulem Karanténa — pokud příjem nasazuje dohled, založ epizodu.
  if (supervision !== "released") {
    const startedOn = blank(values.intake_date) ?? new Date().toISOString().slice(0, 10);
    const days = values.intake_quarantine_days;
    const plannedUntil =
      typeof days === "number" && days > 0 ? addDays(startedOn, days) : null;
    await service.from("quarantine_records").insert({
      animal_id: animalId,
      institution_id: institutionId,
      kind: supervision,
      started_on: startedOn,
      planned_until: plannedUntil,
      reason: "Vstupní karanténa při příjmu",
      created_by: user.id,
    });
  }

  // Automatické zveřejnění — pokud zvíře už při příjmu splní připravenost
  // (např. narozeno → bez karantény, vlastnictví útulku) a má zapnuté
  // auto_publish, přepne se rovnou na „K adopci".
  await maybeAutoPublish(animalId, user.id);

  revalidatePath("/admin/animals");
  redirect("/admin/animals");
}

export async function updateAnimal(id: string, values: AnimalFormValues) {
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();

  // Ověř že zvíře patří útulku (ochrana proti cizímu id) + načti původní hodnoty
  const { data: before } = await service
    .from("animals")
    .select("*")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!before) return { error: "Zvíře nepatří tvému útulku." };

  // Kotva odhadu věku = datum příjmu (stabilní), jinak vznik záznamu, jinak dnešek.
  const b = before as Record<string, unknown>;
  const anchorDate =
    (b.intake_date as string | null) ??
    (b.created_at as string | undefined)?.slice(0, 10) ??
    new Date().toISOString().slice(0, 10);
  const patch = toRow(values, institutionId, anchorDate);
  const { error } = await service.from("animals").update(patch).eq("id", id);

  if (error) return { error: error.message };

  // Auditní historie změn polí.
  await logAnimalFieldChanges(service, {
    animalId: id,
    institutionId,
    changedBy: user.id,
    before: before as Record<string, unknown>,
    after: patch,
  });

  revalidatePath("/admin/animals");
  revalidatePath(`/admin/animals/${id}/historie`);
  revalidatePath(`/animals/${id}`);
  redirect("/admin/animals");
}

type ActionResult = { error: string } | { ok: true };

export async function deleteAnimal(id: string): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();

  const { error } = await service
    .from("animals")
    .delete()
    .eq("id", id)
    .eq("institution_id", institutionId);

  if (error) return { error: error.message };
  revalidatePath("/admin/animals");
  return { ok: true };
}

/**
 * Změna životního stavu zvířete + zápis do auditní historie
 * (animal_status_events). U výstupních stavů (adoptováno / převedeno /
 * úhyn) vyžadujeme poznámku. Při prvním zveřejnění nastaví published_at.
 */
export async function changeAnimalStatus(
  id: string,
  toStatus: AdoptionStatus,
  note?: string,
  /** Důvod přebití tvrdé blokace (jen owner/admin). */
  override?: string,
): Promise<ActionResult> {
  const { institutionId, user, role } = await requireMembership();
  const service = createServiceClient();

  const { data: animal } = await service
    .from("animals")
    .select(`id, adoption_status, ${READINESS_SELECT}`)
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!animal) return { error: "Zvíře nepatří tvému útulku." };

  const fromStatus = animal.adoption_status as AdoptionStatus;
  if (fromStatus === toStatus) return { ok: true };

  // Odvozené stavy se nenastavují ručně — řídí je strukturované toky
  // (Adopce / Pěstoun / Výstupy). Bráníme dvojímu zdroji pravdy.
  if (DERIVED_ADOPTION_STATUSES.includes(toStatus)) {
    const src = DERIVED_STATUS_SOURCE[toStatus] ?? "příslušné záložce";
    return {
      error: `Stav „${toStatus}" nastav přes záložku ${src} — ručně ho měnit nelze.`,
    };
  }

  // Ochranná lhůta = tvrdé oddělení od adopce. Dokud běží, nelze zvíře
  // zveřejnit k adopci („K adopci"), trvale adoptovat ani převést. Veřejně se
  // smí prezentovat výhradně v katalogu nalezenců (přepínač na záložce Příjem).
  // Dočasná péče (foster) je povolena.
  const legalStatus = (animal as { legal_status: string }).legal_status;
  const BLOCKED_DURING_PROTECTION: AdoptionStatus[] = [
    "available",
    "adopted",
    "transferred",
  ];
  if (
    legalStatus === "in_protection" &&
    BLOCKED_DURING_PROTECTION.includes(toStatus)
  ) {
    return {
      error:
        "Zvíře je v ochranné lhůtě — nelze ho zveřejnit k adopci, trvale adoptovat ani převést. Pro veřejnou prezentaci použij katalog nalezenců, nebo ho dej do dočasné péče.",
    };
  }

  // Readiness gate: zveřejnění na web („K adopci") jen po vyřízení příjmu,
  // uzavřené karanténě atd. Tvrdé body smí přebít owner/admin s důvodem.
  const overrideReason = override?.trim() || null;
  let overrideNote: string | null = null;
  if (toStatus === "available") {
    const items = evaluateReadiness(animal as unknown as ReadinessInput);
    const hard = blockers(items, "publish");
    if (hard.length > 0) {
      const canOverride = role === "owner" || role === "admin";
      if (!overrideReason) {
        return {
          error: canOverride
            ? `Zvíře není připravené ke zveřejnění: ${blockerMessage(hard)}. Pro přebití doplň důvod.`
            : `Zvíře nelze zveřejnit: ${blockerMessage(hard)}. Přebití může provést jen majitel nebo admin.`,
        };
      }
      if (!canOverride) {
        return {
          error: "Přebití blokace může provést jen majitel nebo admin.",
        };
      }
      overrideNote = `[PŘEBITÍ připravenosti] ${blockerMessage(hard)} — důvod: ${overrideReason}`;
    }
  }

  const trimmed = note?.trim() || null;
  if (ADOPTION_OUTCOME_STATUSES.includes(toStatus) && !trimmed) {
    return { error: "U výstupního stavu doplň prosím poznámku." };
  }
  const auditNote = [trimmed, overrideNote].filter(Boolean).join(" · ") || null;

  const patch: {
    adoption_status: AdoptionStatus;
    published_at?: string;
    legal_status?: AnimalLegalStatus;
  } = {
    adoption_status: toStatus,
  };
  // Zveřejnění proběhlo skrz readiness gate výše (případně s přebitím), takže
  // při přechodu na veřejný stav doplníme datum prvního zveřejnění.
  if (
    PUBLIC_ADOPTION_STATUSES.includes(toStatus) &&
    !(animal as { published_at: string | null }).published_at
  ) {
    patch.published_at = new Date().toISOString();
  }
  // Provázání os: převod zvířete pryč zároveň převádí vlastnictví (pokud už
  // nebylo vyřešeno jinak). Drží životní cyklus a právní stav v souladu.
  if (toStatus === "transferred" && legalStatus === "shelter_owned") {
    patch.legal_status = "transferred_out";
  }

  const { error: updErr } = await service
    .from("animals")
    .update(patch)
    .eq("id", id);
  if (updErr) return { error: updErr.message };

  const { error: logErr } = await service
    .from("animal_status_events")
    .insert({
      animal_id: id,
      from_status: fromStatus,
      to_status: toStatus,
      note: auditNote,
      changed_by: user.id,
    });
  if (logErr) return { error: logErr.message };

  revalidatePath("/admin/animals");
  revalidatePath(`/admin/animals/${id}`);
  revalidatePath(`/admin/animals/${id}/historie`);
  revalidatePath(`/animals/${id}`);
  return { ok: true };
}
