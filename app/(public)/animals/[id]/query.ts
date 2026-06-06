import { createClient } from "@/lib/supabase/server";
import type {
  AdoptionStatus,
  AdopterExperience,
  AnimalLegalStatus,
  AnimalSize,
  CareDifficulty,
  Compatibility,
  EnergyLevel,
  HealthStatus,
  Sex,
  Species,
  SuitableHousing,
} from "@/types/database";

export interface AnimalDetail {
  id: string;
  name: string;
  species: Species;
  breed: string | null;
  breed_secondary: string | null;
  is_crossbreed: boolean;
  primary_photo_url: string | null;
  gallery: string[];
  description: string | null;
  age_years: number | null;
  age_months: number | null;
  birth_date: string | null;
  sex: Sex;
  size: AnimalSize | null;
  color: string | null;
  weight_kg: number | null;
  is_neutered: boolean | null;
  is_vaccinated: boolean;
  is_chipped: boolean | null;
  health_status: HealthStatus;
  health_notes: string | null;
  good_with_children: Compatibility;
  good_with_dogs: Compatibility;
  good_with_cats: Compatibility;
  energy_level: EnergyLevel | null;
  personality_tags: string[];
  adopter_experience: AdopterExperience;
  care_difficulty: CareDifficulty | null;
  suitable_housing: SuitableHousing | null;
  needs_garden: boolean | null;
  story_title: string | null;
  story_text: string | null;
  adoption_fee: number | null;
  adoption_status: AdoptionStatus;
  legal_status: AnimalLegalStatus;
  found_listing_published: boolean;
  is_urgent: boolean;
  long_stay_boost: boolean;
  intake_date: string | null;
  protection_until: string | null;
  institution: {
    slug: string;
    name: string;
    description: string | null;
    city: string | null;
    region: string | null;
    website: string | null;
    logo_url: string | null;
    opening_hours: string | null;
    foster_enabled: boolean;
    adoption_fee_default: number | null;
  } | null;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function loadAnimal(
  supabase: SupabaseServerClient,
  id: string,
): Promise<AnimalDetail | null> {
  const { data, error } = await supabase
    .from("animals")
    .select(
      `
        id, name, species, breed, breed_secondary, is_crossbreed,
        primary_photo_url, gallery, description,
        age_years, age_months, birth_date, sex, size, color, weight_kg,
        is_neutered, is_vaccinated, is_chipped,
        health_status, health_notes,
        good_with_children, good_with_dogs, good_with_cats,
        energy_level, personality_tags, adopter_experience,
        care_difficulty, suitable_housing, needs_garden,
        story_title, story_text, adoption_fee,
        adoption_status, legal_status, found_listing_published,
        is_urgent, long_stay_boost, intake_date, protection_until,
        institution:institutions!inner(
          slug, name, description, city, region, website, logo_url, is_published,
          opening_hours, foster_enabled, adoption_fee_default
        )
      `,
    )
    .eq("id", id)
    .eq("institutions.is_published", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as AnimalDetail;
}

/**
 * Počet zájemců = aktivní žádosti o adopci (mimo zamítnuté). RLS na žádostech
 * je jen pro útulek, takže veřejné číslo bereme server-side přes service klienta
 * (vrací jen počet, žádná osobní data).
 */
export async function loadInterestCount(animalId: string): Promise<number> {
  const { createServiceClient } = await import("@/lib/supabase/service");
  const service = createServiceClient();
  const { count } = await service
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("animal_id", animalId)
    .neq("status", "rejected");
  return count ?? 0;
}

export interface SimilarAnimal {
  id: string;
  name: string;
  species: Species;
  breed: string | null;
  city: string | null;
  photo: string | null;
  match: {
    species: Species;
    size: AnimalSize | null;
    energy_level: EnergyLevel | null;
    good_with_children: Compatibility;
    good_with_dogs: Compatibility;
    good_with_cats: Compatibility;
    needs_garden: boolean | null;
    suitable_housing: SuitableHousing | null;
    adopter_experience: AdopterExperience;
    care_difficulty: CareDifficulty | null;
    health_status: HealthStatus;
  };
}

/** Podobná zvířata napříč sítí (stejný druh, k adopci) pro „Tobě by sednul i". */
export async function loadSimilar(
  supabase: SupabaseServerClient,
  animal: AnimalDetail,
): Promise<SimilarAnimal[]> {
  const { data } = await supabase
    .from("animals")
    .select(
      `id, name, species, breed, primary_photo_url, size, energy_level,
       good_with_children, good_with_dogs, good_with_cats, needs_garden,
       suitable_housing, adopter_experience, care_difficulty, health_status,
       institution:institutions!inner(city, is_published)`,
    )
    .eq("adoption_status", "available")
    .eq("legal_status", "shelter_owned")
    .eq("species", animal.species)
    .eq("institutions.is_published", true)
    .neq("id", animal.id)
    .limit(12);

  type Row = SimilarAnimal["match"] & {
    id: string;
    name: string;
    breed: string | null;
    primary_photo_url: string | null;
    institution: { city: string | null } | null;
  };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    name: r.name,
    species: r.species,
    breed: r.breed,
    city: r.institution?.city ?? null,
    photo: r.primary_photo_url,
    match: {
      species: r.species,
      size: r.size,
      energy_level: r.energy_level,
      good_with_children: r.good_with_children,
      good_with_dogs: r.good_with_dogs,
      good_with_cats: r.good_with_cats,
      needs_garden: r.needs_garden,
      suitable_housing: r.suitable_housing,
      adopter_experience: r.adopter_experience,
      care_difficulty: r.care_difficulty,
      health_status: r.health_status,
    },
  }));
}
