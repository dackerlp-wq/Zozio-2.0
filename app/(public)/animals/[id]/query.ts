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
  story_title: string | null;
  story_text: string | null;
  adoption_status: AdoptionStatus;
  legal_status: AnimalLegalStatus;
  found_listing_published: boolean;
  is_urgent: boolean;
  long_stay_boost: boolean;
  institution: {
    slug: string;
    name: string;
    description: string | null;
    city: string | null;
    region: string | null;
    website: string | null;
    logo_url: string | null;
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
        care_difficulty, suitable_housing,
        story_title, story_text,
        adoption_status, legal_status, found_listing_published,
        is_urgent, long_stay_boost,
        institution:institutions!inner(
          slug, name, description, city, region, website, logo_url, is_published
        )
      `,
    )
    .eq("id", id)
    .eq("institutions.is_published", true)
    .maybeSingle();

  if (error || !data) return null;
  return data as unknown as AnimalDetail;
}
