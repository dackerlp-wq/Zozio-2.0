"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

type ActionResult = { error: string } | { ok: true };

export interface KennelInput {
  name: string;
  capacity: number;
  is_quarantine: boolean;
  notes: string;
}

export async function createKennel(input: KennelInput): Promise<ActionResult> {
  const { institutionId, role } = await requireMembership();
  if (!["owner", "admin", "staff"].includes(role))
    return { error: "Nemáš oprávnění." };
  if (!input.name.trim()) return { error: "Zadej název kotce." };

  const service = createServiceClient();
  const { error } = await service.from("kennels").insert({
    institution_id: institutionId,
    name: input.name.trim(),
    capacity: input.capacity > 0 ? input.capacity : 1,
    is_quarantine: input.is_quarantine,
    notes: input.notes.trim() || null,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/kennels");
  return { ok: true };
}

export async function updateKennel(
  id: string,
  input: KennelInput,
): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  if (!input.name.trim()) return { error: "Zadej název kotce." };

  const service = createServiceClient();
  const { error } = await service
    .from("kennels")
    .update({
      name: input.name.trim(),
      capacity: input.capacity > 0 ? input.capacity : 1,
      is_quarantine: input.is_quarantine,
      notes: input.notes.trim() || null,
    })
    .eq("id", id)
    .eq("institution_id", institutionId);
  if (error) return { error: error.message };

  revalidatePath("/admin/kennels");
  return { ok: true };
}

export async function deleteKennel(id: string): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();

  // Kotec nelze smazat, pokud v něm je obsazené zvíře.
  const { count } = await service
    .from("animals")
    .select("id", { count: "exact", head: true })
    .eq("kennel_id", id)
    .eq("institution_id", institutionId);
  if (count && count > 0)
    return { error: "Kotec je obsazený — nejprve přesuň zvířata jinam." };

  const { error } = await service
    .from("kennels")
    .delete()
    .eq("id", id)
    .eq("institution_id", institutionId);
  if (error) return { error: error.message };

  revalidatePath("/admin/kennels");
  return { ok: true };
}
