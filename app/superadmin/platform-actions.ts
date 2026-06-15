"use server";

import { revalidatePath } from "next/cache";

import { requireSuperadmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { SHELTER_TESTING_MODE_KEY } from "@/lib/platform-settings";
import type { TestingMode } from "@/lib/plans";

type Result = { error: string } | { ok: true };

/** Uloží konfiguraci banneru testovacího režimu pro útulky. */
export async function updateShelterTestingMode(
  input: TestingMode,
): Promise<Result> {
  await requireSuperadmin();

  const total = Math.max(0, Math.floor(Number(input.total_spots) || 0));
  const used = Math.min(
    total,
    Math.max(0, Math.floor(Number(input.used_spots) || 0)),
  );
  const value: TestingMode = {
    enabled: Boolean(input.enabled),
    total_spots: total,
    used_spots: used,
  };

  const service = createServiceClient();
  const { error } = await service.from("platform_settings").upsert(
    {
      key: SHELTER_TESTING_MODE_KEY,
      value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) return { error: error.message };

  revalidatePath("/pro-utulky");
  revalidatePath("/superadmin");
  return { ok: true };
}
