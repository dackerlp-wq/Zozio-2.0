import { createClient } from "@/lib/supabase/server";

export interface ShelterListItem {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  city: string | null;
  region: string | null;
  is_verified: boolean;
  lat: number | null;
  lng: number | null;
  availableCount: number;
  urgentCount: number;
}

/**
 * Veřejný adresář útulků: jen zveřejněné útulky (type='shelter'), s počty
 * zvířat k adopci a naléhavých + mapa obec→útulek pro hledání podle města.
 * Agreguje napříč sítí (RLS anon = jen published).
 */
export async function loadShelterList(): Promise<{
  shelters: ShelterListItem[];
  regions: string[];
  /** obec_kod → institution_id (kdo obec pokrývá). */
  obecOwner: Record<number, string>;
}> {
  const supabase = await createClient();

  const [institutionsRes, animalsRes, muniRes] = await Promise.all([
    supabase
      .from("institutions")
      .select("id, slug, name, description, logo_url, city, region, is_verified, lat, lng")
      .eq("type", "shelter")
      .eq("is_published", true)
      .order("name", { ascending: true }),
    supabase
      .from("animals")
      .select("institution_id, is_urgent")
      .eq("adoption_status", "available")
      .neq("legal_status", "in_protection")
      .limit(5000),
    supabase.from("shelter_municipalities").select("obec_kod, institution_id"),
  ]);

  type InstRow = Omit<ShelterListItem, "availableCount" | "urgentCount">;
  const insts = (institutionsRes.data ?? []) as unknown as InstRow[];

  const available = new Map<string, number>();
  const urgent = new Map<string, number>();
  for (const a of (animalsRes.data ?? []) as { institution_id: string; is_urgent: boolean }[]) {
    available.set(a.institution_id, (available.get(a.institution_id) ?? 0) + 1);
    if (a.is_urgent) urgent.set(a.institution_id, (urgent.get(a.institution_id) ?? 0) + 1);
  }

  const obecOwner: Record<number, string> = {};
  for (const m of (muniRes.data ?? []) as { obec_kod: number; institution_id: string }[]) {
    obecOwner[m.obec_kod] = m.institution_id;
  }

  const shelters: ShelterListItem[] = insts.map((i) => ({
    ...i,
    availableCount: available.get(i.id) ?? 0,
    urgentCount: urgent.get(i.id) ?? 0,
  }));

  const regions = [...new Set(insts.map((i) => i.region).filter((r): r is string => Boolean(r)))].sort(
    (a, b) => a.localeCompare(b, "cs"),
  );

  return { shelters, regions, obecOwner };
}
