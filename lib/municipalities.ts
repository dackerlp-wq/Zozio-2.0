import { createClient } from "@/lib/supabase/server";

export interface MapShelter {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  region: string | null;
  isVerified: boolean;
  lat: number | null;
  lng: number | null;
  animalCount: number;
  obecCount: number;
}

export interface MapData {
  shelters: MapShelter[];
  /** obec_kod → institution_id (kdo pokrývá danou obec). */
  obecOwner: Record<number, string>;
  /** obec_kod → název (jen pokryté obce, pro sidebar/seznam). */
  coveredObce: { kod: number; nazev: string; institutionId: string }[];
}

/** Veřejná data pro mapu: zveřejněné útulky + jejich spádové obce + počty zvířat. */
export async function loadMapData(): Promise<MapData> {
  const supabase = await createClient();

  const [institutionsRes, muniRes, animalsRes] = await Promise.all([
    supabase
      .from("institutions")
      .select("id, slug, name, city, region, is_verified, lat, lng")
      .eq("type", "shelter")
      .eq("is_published", true),
    supabase.from("shelter_municipalities").select("obec_kod, obec_nazev, institution_id"),
    supabase
      .from("animals")
      .select("institution_id")
      .eq("adoption_status", "available")
      .neq("legal_status", "in_protection")
      .limit(5000),
  ]);

  type InstRow = {
    id: string;
    slug: string;
    name: string;
    city: string | null;
    region: string | null;
    is_verified: boolean;
    lat: number | null;
    lng: number | null;
  };
  const insts = (institutionsRes.data ?? []) as InstRow[];
  const muni = (muniRes.data ?? []) as { obec_kod: number; obec_nazev: string; institution_id: string }[];

  const animalCount = new Map<string, number>();
  for (const a of (animalsRes.data ?? []) as { institution_id: string }[]) {
    animalCount.set(a.institution_id, (animalCount.get(a.institution_id) ?? 0) + 1);
  }
  const obecCount = new Map<string, number>();
  const obecOwner: Record<number, string> = {};
  for (const m of muni) {
    obecOwner[m.obec_kod] = m.institution_id;
    obecCount.set(m.institution_id, (obecCount.get(m.institution_id) ?? 0) + 1);
  }

  const shelters: MapShelter[] = insts.map((i) => ({
    id: i.id,
    slug: i.slug,
    name: i.name,
    city: i.city,
    region: i.region,
    isVerified: i.is_verified,
    lat: i.lat,
    lng: i.lng,
    animalCount: animalCount.get(i.id) ?? 0,
    obecCount: obecCount.get(i.id) ?? 0,
  }));

  return {
    shelters,
    obecOwner,
    coveredObce: muni.map((m) => ({ kod: m.obec_kod, nazev: m.obec_nazev, institutionId: m.institution_id })),
  };
}

/** Barevná paleta pro spádové oblasti útulků (translucentní, bez modré). */
export const TERRITORY_COLORS = [
  "#E8634A", // terracotta
  "#F0A500", // amber
  "#C9A87C", // sand2
  "#1A7A45", // success/fern
  "#9B5E35", // brown-mid
  "#C44B33", // coral-dark
];

export function colorForIndex(i: number): string {
  return TERRITORY_COLORS[i % TERRITORY_COLORS.length];
}
