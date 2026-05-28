"use server";

import { revalidatePath } from "next/cache";

import { requireSuperadmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

type Result = { error: string } | { ok: true };

export async function approveInstitution(id: string): Promise<Result> {
  await requireSuperadmin();
  const service = createServiceClient();

  const { error } = await service
    .from("institutions")
    .update({
      verification_status: "approved",
      is_verified: true,
      verified_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/superadmin/institutions");
  revalidatePath(`/superadmin/institutions/${id}`);
  return { ok: true };
}

export async function rejectInstitution(
  id: string,
  reason: string,
): Promise<Result> {
  await requireSuperadmin();
  if (!reason.trim()) {
    return { error: "Uveď prosím důvod zamítnutí." };
  }
  const service = createServiceClient();

  const { error } = await service
    .from("institutions")
    .update({
      verification_status: "rejected",
      is_verified: false,
      is_published: false,
      verified_at: null,
      rejection_reason: reason.trim(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/superadmin/institutions");
  revalidatePath(`/superadmin/institutions/${id}`);
  return { ok: true };
}
