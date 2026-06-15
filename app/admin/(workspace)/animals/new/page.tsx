import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AnimalBreedRow } from "@/types/database";

import { AnimalForm, type KennelChoice } from "../animal-form";
import { createAnimal } from "../actions";

export const metadata = { title: "Nové zvíře — Zozio Admin" };

export default async function NewAnimalPage() {
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const [{ data: kennelData }, { data: animalData }, { data: breedRows }] =
    await Promise.all([
      supabase
        .from("kennels")
        .select("id, name, capacity, is_quarantine")
        .eq("institution_id", institutionId)
        .order("name", { ascending: true }),
      supabase
        .from("animals")
        .select("kennel_id")
        .eq("institution_id", institutionId),
      supabase
        .from("animal_breeds")
        .select("species, name")
        .is("institution_id", null)
        .order("name", { ascending: true }),
    ]);

  // Globální číselník plemen, seskupený podle druhu (stejně jako v profilu).
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

  const occCount = new Map<string, number>();
  for (const a of (animalData ?? []) as { kennel_id: string | null }[]) {
    if (a.kennel_id)
      occCount.set(a.kennel_id, (occCount.get(a.kennel_id) ?? 0) + 1);
  }

  const kennels: KennelChoice[] = (
    (kennelData ?? []) as {
      id: string;
      name: string;
      capacity: number;
      is_quarantine: boolean;
    }[]
  ).map((k) => ({
    id: k.id,
    name: k.name,
    capacity: k.capacity,
    is_quarantine: k.is_quarantine,
    occupied: occCount.get(k.id) ?? 0,
  }));

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
          Příjem nového zvířete
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          Vyplň příjmový protokol. Zvíře se založí ve stavu „Příjem" a na web ho
          pustíš až po vyřešení práva a karantény.
        </p>
      </div>

      <AnimalForm
        onSubmit={createAnimal}
        submitLabel="Přijmout zvíře"
        showIntake
        kennels={kennels}
        breedsBySpecies={breedsBySpecies}
      />
    </div>
  );
}
