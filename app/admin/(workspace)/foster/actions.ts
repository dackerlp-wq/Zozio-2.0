"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

type ActionResult = { error: string } | { ok: true };

export interface FosterCarerValues {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  region: string;
  capacity: number | null;
  species_note: string;
  notes: string;
  is_active: boolean;
  /** Dovednosti / preference pěstouna (umí léky, zahrada, velcí psi…). */
  tags: string[];
}

function toRow(v: FosterCarerValues, institutionId: string) {
  return {
    institution_id: institutionId,
    name: v.name.trim(),
    email: v.email.trim() || null,
    phone: v.phone.trim() || null,
    address: v.address.trim() || null,
    city: v.city.trim() || null,
    region: v.region.trim() || null,
    capacity: v.capacity,
    species_note: v.species_note.trim() || null,
    notes: v.notes.trim() || null,
    is_active: v.is_active,
    tags: v.tags.length > 0 ? v.tags : null,
  };
}

export async function createFosterCarer(
  values: FosterCarerValues,
): Promise<{ ok: true; id: string } | { error: string }> {
  const { institutionId, role, user } = await requireMembership();
  if (!["owner", "admin", "staff"].includes(role)) {
    return { error: "Nemáš oprávnění přidávat pěstouny." };
  }
  if (!values.name.trim()) return { error: "Vyplň jméno pěstouna." };

  const service = createServiceClient();
  const { data, error } = await service
    .from("foster_carers")
    .insert({ ...toRow(values, institutionId), created_by: user.id })
    .select("id")
    .single();
  if (error || !data) {
    return { error: error?.message ?? "Pěstouna se nepodařilo vytvořit." };
  }

  revalidatePath("/admin/foster");
  return { ok: true, id: data.id };
}

export async function updateFosterCarer(
  id: string,
  values: FosterCarerValues,
): Promise<ActionResult> {
  const { institutionId, role } = await requireMembership();
  if (!["owner", "admin", "staff"].includes(role)) {
    return { error: "Nemáš oprávnění upravovat pěstouny." };
  }

  const service = createServiceClient();
  const { error } = await service
    .from("foster_carers")
    .update(toRow(values, institutionId))
    .eq("id", id)
    .eq("institution_id", institutionId);
  if (error) return { error: error.message };

  revalidatePath("/admin/foster");
  revalidatePath(`/admin/foster/${id}`);
  return { ok: true };
}

export async function deleteFosterCarer(id: string): Promise<ActionResult> {
  const { institutionId, role } = await requireMembership();
  if (!["owner", "admin"].includes(role)) {
    return { error: "Smazat pěstouna může jen vlastník nebo administrátor." };
  }

  const service = createServiceClient();

  // Pojistka: nelze smazat pěstouna s běžícím umístěním.
  const { count } = await service
    .from("foster_placements")
    .select("id", { count: "exact", head: true })
    .eq("carer_id", id)
    .is("ended_on", null);
  if ((count ?? 0) > 0) {
    return {
      error: "Pěstoun má aktivní umístění. Nejprve ho ukonči.",
    };
  }

  const { error } = await service
    .from("foster_carers")
    .delete()
    .eq("id", id)
    .eq("institution_id", institutionId);
  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "Pěstoun má historii umístění — místo smazání ho deaktivuj.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/admin/foster");
  return { ok: true };
}
