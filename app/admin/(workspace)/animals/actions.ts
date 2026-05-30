"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import {
  ADOPTION_OUTCOME_STATUSES,
  PUBLIC_ADOPTION_STATUSES,
} from "@/lib/format";
import type {
  AdoptionStatus,
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
}

function toRow(v: AnimalFormValues, institutionId: string) {
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

export async function createAnimal(values: AnimalFormValues) {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();

  const { data, error } = await service
    .from("animals")
    .insert({ ...toRow(values, institutionId), published_at: new Date().toISOString() })
    .select("id")
    .single();

  if (error || !data) {
    return { error: error?.message ?? "Zvíře se nepodařilo vytvořit." };
  }

  revalidatePath("/admin/animals");
  redirect("/admin/animals");
}

export async function updateAnimal(id: string, values: AnimalFormValues) {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();

  // Ověř že zvíře patří útulku (ochrana proti cizímu id)
  const { data: owned } = await service
    .from("animals")
    .select("id")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!owned) return { error: "Zvíře nepatří tvému útulku." };

  const { error } = await service
    .from("animals")
    .update(toRow(values, institutionId))
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/admin/animals");
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
): Promise<ActionResult> {
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();

  const { data: animal } = await service
    .from("animals")
    .select("id, adoption_status, published_at")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!animal) return { error: "Zvíře nepatří tvému útulku." };

  const fromStatus = animal.adoption_status as AdoptionStatus;
  if (fromStatus === toStatus) return { ok: true };

  const trimmed = note?.trim() || null;
  if (ADOPTION_OUTCOME_STATUSES.includes(toStatus) && !trimmed) {
    return { error: "U výstupního stavu doplň prosím poznámku." };
  }

  const patch: { adoption_status: AdoptionStatus; published_at?: string } = {
    adoption_status: toStatus,
  };
  if (
    PUBLIC_ADOPTION_STATUSES.includes(toStatus) &&
    !(animal as { published_at: string | null }).published_at
  ) {
    patch.published_at = new Date().toISOString();
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
      note: trimmed,
      changed_by: user.id,
    });
  if (logErr) return { error: logErr.message };

  revalidatePath("/admin/animals");
  revalidatePath(`/admin/animals/${id}`);
  revalidatePath(`/admin/animals/${id}/historie`);
  revalidatePath(`/animals/${id}`);
  return { ok: true };
}
