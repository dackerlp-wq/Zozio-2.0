import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { DEFAULT_TESTING_MODE, type TestingMode } from "@/lib/plans";

const SHELTER_TESTING_MODE_KEY = "shelter_testing_mode";

/** Normalizuje uloženou JSON hodnotu na bezpečný `TestingMode`. */
function parseTestingMode(value: unknown): TestingMode {
  if (!value || typeof value !== "object") return DEFAULT_TESTING_MODE;
  const v = value as Record<string, unknown>;
  const total = Number(v.total_spots);
  const used = Number(v.used_spots);
  return {
    enabled: v.enabled === true,
    total_spots: Number.isFinite(total) && total >= 0 ? Math.floor(total) : DEFAULT_TESTING_MODE.total_spots,
    used_spots: Number.isFinite(used) && used >= 0 ? Math.floor(used) : 0,
  };
}

/** Načte konfiguraci banneru testovacího režimu (s fallbackem na default). */
export async function loadShelterTestingMode(): Promise<TestingMode> {
  const service = createServiceClient();
  const { data } = await service
    .from("platform_settings")
    .select("value")
    .eq("key", SHELTER_TESTING_MODE_KEY)
    .maybeSingle();
  if (!data) return DEFAULT_TESTING_MODE;
  return parseTestingMode((data as { value: unknown }).value);
}

export { SHELTER_TESTING_MODE_KEY };
