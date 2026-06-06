import { notFound } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isClosedStatus } from "@/lib/animal-tabs-layout";
import type { AnimalBreedRow, AnimalRow } from "@/types/database";

import { ProfileEditor, type ProfileInitial } from "../profile-editor";

export const metadata = { title: "Profil zvířete — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AnimalProfilePage({ params }: PageProps) {
  const { id } = await params;
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const { data } = await supabase
    .from("animals")
    .select("*")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!data) notFound();
  const a = data as AnimalRow;

  // Výchozí adopční poplatek útulku (fallback pro zvířata bez vlastní částky).
  const { data: inst } = await supabase
    .from("institutions")
    .select("adoption_fee_default")
    .eq("id", institutionId)
    .maybeSingle();

  // Číselník plemen: globální katalog, seskupený podle druhu.
  const { data: breedRows } = await supabase
    .from("animal_breeds")
    .select("species, name")
    .is("institution_id", null)
    .order("name", { ascending: true });

  const breedsBySpecies: Record<string, string[]> = {
    dog: [],
    cat: [],
    rabbit: [],
    other: [],
  };
  for (const r of (breedRows ?? []) as Pick<
    AnimalBreedRow,
    "species" | "name"
  >[]) {
    (breedsBySpecies[r.species] ??= []).push(r.name);
  }
  for (const sp of Object.keys(breedsBySpecies)) {
    breedsBySpecies[sp] = [...new Set(breedsBySpecies[sp])].sort((x, y) =>
      x.localeCompare(y, "cs"),
    );
  }

  const initial: ProfileInitial = {
    name: a.name ?? "",
    species: a.species,
    sex: a.sex,
    breed: a.breed ?? "",
    is_crossbreed: Boolean(a.is_crossbreed),
    breed_secondary: a.breed_secondary ?? "",
    primary_photo_url: a.primary_photo_url ?? "",
    gallery: a.gallery ?? [],
    date_of_birth: a.birth_date_is_estimate ? "" : (a.birth_date ?? ""),
    age_years: a.age_years,
    age_months: a.age_months,
    size: a.size,
    color: a.color ?? "",
    personality_tags: a.personality_tags ?? [],
    story_text: a.story_text ?? "",
    description: a.description ?? "",
    good_with_children: a.good_with_children,
    good_with_dogs: a.good_with_dogs,
    good_with_cats: a.good_with_cats,
    suitable_housing: a.suitable_housing,
    adoption_fee: a.adoption_fee ?? null,
    institution_fee_default:
      (inst as { adoption_fee_default: number | null } | null)
        ?.adoption_fee_default ?? null,
  };

  return (
    <ProfileEditor
      animalId={id}
      initial={initial}
      breedsBySpecies={breedsBySpecies}
      readOnly={isClosedStatus(a.adoption_status)}
      isAvailable={a.adoption_status === "available"}
    />
  );
}
