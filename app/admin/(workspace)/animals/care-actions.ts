"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { CareLogType } from "@/types/database";

type ActionResult = { error: string } | { ok: true };

export interface CareLogInput {
  type: CareLogType;
  note: string;
  photo_urls: string[];
}

export async function addCareLog(
  animalId: string,
  input: CareLogInput,
): Promise<ActionResult> {
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();

  const { data: animal } = await service
    .from("animals")
    .select("id")
    .eq("id", animalId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!animal) return { error: "Zvíře nepatří tvému útulku." };

  const note = input.note.trim();
  if (!note && input.photo_urls.length === 0)
    return { error: "Přidej poznámku nebo fotku." };

  const { error } = await service.from("care_log_entries").insert({
    animal_id: animalId,
    institution_id: institutionId,
    type: input.type,
    note: note || null,
    photo_urls: input.photo_urls,
    logged_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/animals/${animalId}/pece`);
  return { ok: true };
}

export async function deleteCareLog(
  entryId: string,
  animalId: string,
): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();

  const { error } = await service
    .from("care_log_entries")
    .delete()
    .eq("id", entryId)
    .eq("animal_id", animalId)
    .eq("institution_id", institutionId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/animals/${animalId}/pece`);
  return { ok: true };
}
