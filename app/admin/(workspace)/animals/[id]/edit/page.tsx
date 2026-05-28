import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { AnimalForm } from "../../animal-form";
import { updateAnimal, type AnimalFormValues } from "../../actions";

export const metadata = { title: "Upravit zvíře — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditAnimalPage({ params }: PageProps) {
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

  const a = data as Record<string, unknown>;
  const initial: Partial<AnimalFormValues> = {
    name: (a.name as string) ?? "",
    species: a.species as AnimalFormValues["species"],
    breed: (a.breed as string) ?? "",
    is_crossbreed: Boolean(a.is_crossbreed),
    breed_secondary: (a.breed_secondary as string) ?? "",
    primary_photo_url: (a.primary_photo_url as string) ?? "",
    gallery: (a.gallery as string[]) ?? [],
    description: (a.description as string) ?? "",
    age_years: (a.age_years as number) ?? null,
    age_months: (a.age_months as number) ?? null,
    sex: a.sex as AnimalFormValues["sex"],
    size: (a.size as AnimalFormValues["size"]) ?? null,
    color: (a.color as string) ?? "",
    weight_kg: (a.weight_kg as number) ?? null,
    is_neutered: (a.is_neutered as boolean) ?? null,
    is_vaccinated: Boolean(a.is_vaccinated),
    is_chipped: (a.is_chipped as boolean) ?? null,
    health_status: a.health_status as AnimalFormValues["health_status"],
    health_notes: (a.health_notes as string) ?? "",
    good_with_children: a.good_with_children as AnimalFormValues["good_with_children"],
    good_with_dogs: a.good_with_dogs as AnimalFormValues["good_with_dogs"],
    good_with_cats: a.good_with_cats as AnimalFormValues["good_with_cats"],
    energy_level: (a.energy_level as AnimalFormValues["energy_level"]) ?? null,
    care_difficulty: (a.care_difficulty as AnimalFormValues["care_difficulty"]) ?? null,
    suitable_housing: (a.suitable_housing as AnimalFormValues["suitable_housing"]) ?? null,
    personality_tags: (a.personality_tags as string[]) ?? [],
    story_title: (a.story_title as string) ?? "",
    story_text: (a.story_text as string) ?? "",
    adoption_status: a.adoption_status as AnimalFormValues["adoption_status"],
    is_urgent: Boolean(a.is_urgent),
  };

  const updateThis = updateAnimal.bind(null, id);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/animals"
          className="inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-sage-700"
        >
          <ChevronLeft className="size-4" /> Zpět na zvířata
        </Link>
        <h2 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink-900">
          Upravit: {initial.name}
        </h2>
      </div>

      <AnimalForm
        initial={initial}
        onSubmit={updateThis}
        submitLabel="Uložit změny"
      />
    </div>
  );
}
