"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { TreatmentType } from "@/types/database";

type ActionResult = { error: string } | { ok: true };

/** Ověří, že zvíře patří útulku přihlášeného uživatele. */
async function assertOwned(animalId: string) {
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();
  const { data } = await service
    .from("animals")
    .select("id")
    .eq("id", animalId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  return { ok: Boolean(data), service, userId: user.id };
}

function revalidateHealth(animalId: string) {
  revalidatePath(`/admin/animals/${animalId}/zdravi`);
  revalidatePath(`/animals/${animalId}`);
}

// ---- Váha -----------------------------------------------------------------

export interface WeightInput {
  weight_kg: number;
  measured_at: string; // YYYY-MM-DD
  note: string;
}

export async function addWeightLog(
  animalId: string,
  input: WeightInput,
): Promise<ActionResult> {
  const { ok, service, userId } = await assertOwned(animalId);
  if (!ok) return { error: "Zvíře nepatří tvému útulku." };
  if (!input.weight_kg || input.weight_kg <= 0)
    return { error: "Zadej platnou váhu." };

  const { error } = await service.from("weight_logs").insert({
    animal_id: animalId,
    weight_kg: input.weight_kg,
    measured_at: input.measured_at || new Date().toISOString().slice(0, 10),
    note: input.note.trim() || null,
    created_by: userId,
  });
  if (error) return { error: error.message };

  // Zrcadli poslední váhu do karty zvířete.
  await service
    .from("animals")
    .update({ weight_kg: input.weight_kg })
    .eq("id", animalId);

  revalidateHealth(animalId);
  return { ok: true };
}

// ---- Očkování -------------------------------------------------------------

export interface VaccinationInput {
  vaccine: string;
  administered_at: string;
  valid_until: string;
  vet_name: string;
  notes: string;
}

export async function addVaccination(
  animalId: string,
  input: VaccinationInput,
): Promise<ActionResult> {
  const { ok, service } = await assertOwned(animalId);
  if (!ok) return { error: "Zvíře nepatří tvému útulku." };
  if (!input.vaccine.trim()) return { error: "Zadej název vakcíny." };

  const { error } = await service.from("vaccinations").insert({
    animal_id: animalId,
    vaccine: input.vaccine.trim(),
    administered_at:
      input.administered_at || new Date().toISOString().slice(0, 10),
    valid_until: input.valid_until || null,
    vet_name: input.vet_name.trim() || null,
    notes: input.notes.trim() || null,
  });
  if (error) return { error: error.message };

  await service
    .from("animals")
    .update({ is_vaccinated: true })
    .eq("id", animalId);

  revalidateHealth(animalId);
  return { ok: true };
}

// ---- Léčba ----------------------------------------------------------------

export interface TreatmentInput {
  type: TreatmentType;
  name: string;
  dosage: string;
  frequency: string;
  start_date: string;
  end_date: string;
  next_due: string;
  vet_name: string;
  notes: string;
}

export async function addTreatment(
  animalId: string,
  input: TreatmentInput,
): Promise<ActionResult> {
  const { ok, service, userId } = await assertOwned(animalId);
  if (!ok) return { error: "Zvíře nepatří tvému útulku." };
  if (!input.name.trim()) return { error: "Zadej název léčby." };

  const { error } = await service.from("treatments").insert({
    animal_id: animalId,
    type: input.type,
    name: input.name.trim(),
    dosage: input.dosage.trim() || null,
    frequency: input.frequency.trim() || null,
    start_date: input.start_date || null,
    end_date: input.end_date || null,
    next_due: input.next_due || null,
    vet_name: input.vet_name.trim() || null,
    notes: input.notes.trim() || null,
    created_by: userId,
  });
  if (error) return { error: error.message };

  revalidateHealth(animalId);
  return { ok: true };
}

// ---- Veterinární záznamy --------------------------------------------------

export interface VetRecordInput {
  recorded_at: string;
  category: string;
  title: string;
  vet_name: string;
  notes: string;
}

export async function addVetRecord(
  animalId: string,
  input: VetRecordInput,
): Promise<ActionResult> {
  const { ok, service } = await assertOwned(animalId);
  if (!ok) return { error: "Zvíře nepatří tvému útulku." };
  if (!input.title.trim()) return { error: "Zadej název záznamu." };

  const { error } = await service.from("vet_records").insert({
    animal_id: animalId,
    recorded_at: input.recorded_at || new Date().toISOString().slice(0, 10),
    category: input.category.trim() || "Obecné",
    title: input.title.trim(),
    vet_name: input.vet_name.trim() || null,
    notes: input.notes.trim() || null,
  });
  if (error) return { error: error.message };

  revalidateHealth(animalId);
  return { ok: true };
}

// ---- Mazání ---------------------------------------------------------------

const DELETABLE = [
  "weight_logs",
  "vaccinations",
  "treatments",
  "vet_records",
] as const;
type DeletableTable = (typeof DELETABLE)[number];

export async function deleteHealthEntry(
  table: DeletableTable,
  entryId: string,
  animalId: string,
): Promise<ActionResult> {
  if (!DELETABLE.includes(table)) return { error: "Neplatná tabulka." };
  const { ok, service } = await assertOwned(animalId);
  if (!ok) return { error: "Zvíře nepatří tvému útulku." };

  const { error } = await service
    .from(table)
    .delete()
    .eq("id", entryId)
    .eq("animal_id", animalId);
  if (error) return { error: error.message };

  revalidateHealth(animalId);
  return { ok: true };
}
