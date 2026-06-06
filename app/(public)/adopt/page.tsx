import Link from "next/link";

import { ZozioButton } from "@/components/zozio/button";
import { createClient } from "@/lib/supabase/server";
import { SPECIES_LABEL } from "@/lib/format";
import { animalAgeLabel } from "@/lib/animal-age";
import type {
  AdopterExperience,
  AdoptionStatus,
  AnimalSize,
  CareDifficulty,
  Compatibility,
  EnergyLevel,
  HealthStatus,
  Sex,
  Species,
  SuitableHousing,
} from "@/types/database";

import { AdoptFilters, type FilterOptions } from "./filters";
import {
  computeFacets,
  normalize,
  type FilterableAnimal,
  type FilterValues,
} from "./facets";
import { AdoptResults, type ScoredCard } from "./adopt-results";
import { loadAdopterPreferences } from "./matching-actions";

interface AnimalListRow {
  id: string;
  name: string;
  species: Species;
  breed: string | null;
  age_years: number | null;
  age_months: number | null;
  birth_date: string | null;
  primary_photo_url: string | null;
  adoption_status: AdoptionStatus;
  is_urgent: boolean;
  long_stay_boost: boolean;
  personality_tags: string[];
  created_at: string;
  intake_date: string | null;
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
  institution: { name: string; city: string | null; is_published: boolean } | null;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

const PAGE_SIZE = 12;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    species?: string;
    sex?: string;
    age?: string;
    size?: string;
    breed?: string;
    color?: string;
    tag?: string | string[];
    vaccinated?: string;
    neutered?: string;
    handicap?: string;
    care?: string;
    housing?: string;
    city?: string;
    shelter?: string;
    page?: string;
  }>;
}

export const metadata = {
  title: "Adoptuj zvíře — Zozio",
  description:
    "Procházej tisíce zvířat z útulků v ČR a SK. Filtruj podle druhu, věku, povahy a najdi svého parťáka.",
};

export default async function AdoptPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const species = sp.species ?? "";
  const sex = sp.sex ?? "";
  const age = sp.age ?? "";
  const size = sp.size ?? "";
  const breed = sp.breed?.trim() ?? "";
  const color = sp.color?.trim() ?? "";
  const tags = Array.isArray(sp.tag) ? sp.tag : sp.tag ? [sp.tag] : [];
  const vaccinated = sp.vaccinated ?? "";
  const neutered = sp.neutered ?? "";
  const handicap = sp.handicap ?? "";
  const care = sp.care ?? "";
  const housing = sp.housing ?? "";
  const city = sp.city?.trim() ?? "";
  const shelter = sp.shelter ?? "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const supabase = await createClient();

  let query = supabase
    .from("animals")
    .select(
      "id, name, species, breed, age_years, age_months, birth_date, primary_photo_url, adoption_status, is_urgent, long_stay_boost, personality_tags, created_at, intake_date, size, energy_level, good_with_children, good_with_dogs, good_with_cats, needs_garden, suitable_housing, adopter_experience, care_difficulty, health_status, institution:institutions!inner(name, city, is_published)",
      { count: "exact" },
    )
    .eq("adoption_status", "available")
    // Zvířata v ochranné lhůtě se nenabízejí k adopci — patří do katalogu
    // nalezenců „Hledají svého páníčka", ne sem.
    .neq("legal_status", "in_protection")
    .eq("institutions.is_published", true);

  if (species) query = query.eq("species", species as Species);
  if (sex) query = query.eq("sex", sex as Sex);
  if (size) query = query.eq("size", size as AnimalSize);
  if (breed) query = query.ilike("breed", `%${breed}%`);
  if (color) query = query.ilike("color", `%${color}%`);
  if (city) query = query.ilike("institutions.city", `%${city}%`);
  if (shelter) query = query.eq("institution_id", shelter);
  if (tags.length > 0) query = query.contains("personality_tags", tags);
  if (vaccinated === "yes") query = query.eq("is_vaccinated", true);
  if (vaccinated === "no") query = query.eq("is_vaccinated", false);
  if (neutered === "yes") query = query.eq("is_neutered", true);
  if (neutered === "no") query = query.eq("is_neutered", false);
  if (handicap === "yes") query = query.eq("health_status", "special_needs" satisfies HealthStatus);
  if (handicap === "no") query = query.in("health_status", ["healthy", "treated"] satisfies HealthStatus[]);
  if (care) query = query.eq("care_difficulty", care as CareDifficulty);
  if (housing)
    query = query.in("suitable_housing", [housing as SuitableHousing, "both"]);

  // Věkové kategorie přes datum narození (živý věk).
  // Hranice = dnešek minus N let; mladší = pozdější (větší) datum narození.
  if (age) {
    const yearsAgo = (n: number): string => {
      const d = new Date();
      d.setUTCFullYear(d.getUTCFullYear() - n);
      return d.toISOString().slice(0, 10);
    };
    const d1 = yearsAgo(1);
    const d3 = yearsAgo(3);
    const d8 = yearsAgo(8);
    if (age === "puppy") {
      // < 1 rok nebo neznámé datum narození
      query = query.or(`birth_date.gt.${d1},birth_date.is.null`);
    } else if (age === "young") {
      query = query.lte("birth_date", d1).gt("birth_date", d3);
    } else if (age === "adult") {
      query = query.lte("birth_date", d3).gt("birth_date", d8);
    } else if (age === "senior") {
      query = query.lte("birth_date", d8);
    }
  }

  if (q) {
    const tsq = q
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(Boolean)
      .map((w) => `${w}:*`)
      .join(" & ");
    if (tsq) query = query.textSearch("search_vector", tsq);
  }

  query = query
    .order("is_urgent", { ascending: false })
    .order("long_stay_boost", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const filterValues: FilterValues = {
    q, species, sex, age, size, breed, color, tags,
    vaccinated, neutered, handicap, care, housing, city, shelter,
  };

  const [
    { data, count, error },
    filterOptions,
    allAvailable,
    {
      data: { user },
    },
    savedPrefs,
  ] = await Promise.all([
    query,
    loadFilterOptions(supabase),
    loadAllAvailableAnimals(supabase),
    supabase.auth.getUser(),
    loadAdopterPreferences(),
  ]);

  const facets = computeFacets(allAvailable, filterValues);

  const rows = (data ?? []) as unknown as AnimalListRow[];

  const cards: ScoredCard[] = rows.map((a) => ({
    id: a.id,
    name: a.name,
    species: a.species === "cat" ? "cat" : a.species === "dog" ? "dog" : "other",
    breed: a.breed ?? "—",
    ageLabel: animalAgeLabel(a),
    city: a.institution?.city ?? "",
    shelterName: a.institution?.name ?? "",
    photoUrl: a.primary_photo_url ?? "",
    status: a.adoption_status as "available" | "reserved" | "adopted",
    isUrgent: a.is_urgent,
    isLongStay: a.long_stay_boost,
    tags: a.personality_tags ?? [],
    createdAt: a.created_at,
    intakeDate: a.intake_date ?? a.created_at,
    match: {
      species: a.species,
      size: a.size,
      energy_level: a.energy_level,
      good_with_children: a.good_with_children,
      good_with_dogs: a.good_with_dogs,
      good_with_cats: a.good_with_cats,
      needs_garden: a.needs_garden,
      suitable_housing: a.suitable_housing,
      adopter_experience: a.adopter_experience,
      care_difficulty: a.care_difficulty,
      health_status: a.health_status,
    },
  }));

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  const activeFilters = countActiveFilters({
    q, species, sex, age, size, breed, color, vaccinated, neutered, handicap,
    care, housing, city, shelter,
    tags,
  });

  return (
    <div className="bg-background">
      {/* Header */}
      <section className="border-b border-ink-900/8 bg-cream-warm">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:py-14">
          <div className="space-y-3">
            <div className="font-mono text-xs uppercase tracking-wider text-meadow-700">
              Katalog
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-ink-900 md:text-5xl">
              {q
                ? `Hledáš „${q}"`
                : species && SPECIES_LABEL[species]
                  ? `${SPECIES_LABEL[species]}i hledající domov`
                  : "Najdi svého parťáka"}
            </h1>
            <p className="text-lg text-ink-600">
              {count !== null
                ? `${count.toLocaleString("cs-CZ")} zvířat odpovídá filtru`
                : "Načítám…"}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
          {/* Sidebar */}
          <AdoptFilters
            initial={filterValues}
            options={filterOptions}
            facets={facets}
            activeCount={activeFilters}
            resultCount={count ?? 0}
          />

          {/* Content */}
          <div className="min-w-0">
            {error && (
              <div className="mb-6 rounded-2xl bg-peach-100 p-4 text-sm text-terracotta-600 ring-1 ring-inset ring-peach-300">
                Chyba při načítání: {error.message}
              </div>
            )}

            {cards.length === 0 ? (
              <div className="rounded-3xl bg-cream-warm p-12 text-center">
                <div className="text-4xl">🐾</div>
                <h2 className="mt-4 font-display text-2xl font-semibold text-ink-900">
                  Nic jsme nenašli
                </h2>
                <p className="mt-2 text-ink-600">
                  {activeFilters > 0
                    ? "Zkus uvolnit některé filtry."
                    : "Zatím tu nejsou žádná zvířata."}
                </p>
                {activeFilters > 0 && (
                  <ZozioButton asChild variant="outline" size="md" className="mt-6">
                    <Link href="/adopt">Vyčistit filtry</Link>
                  </ZozioButton>
                )}
              </div>
            ) : (
              <AdoptResults
                cards={cards}
                initial={savedPrefs}
                isLoggedIn={!!user}
                page={page}
                totalPages={totalPages}
                searchParams={sp}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Helpers ------------------------------------------------------------

async function loadAllAvailableAnimals(
  supabase: SupabaseServerClient,
): Promise<FilterableAnimal[]> {
  const { data } = await supabase
    .from("animals")
    .select(
      "id, species, sex, age_years, birth_date, size, breed, color, personality_tags, is_vaccinated, is_neutered, health_status, care_difficulty, suitable_housing, institution_id, institution:institutions!inner(city, is_published)",
    )
    .eq("adoption_status", "available")
    .neq("legal_status", "in_protection")
    .eq("institutions.is_published", true)
    .limit(2000);

  type Row = {
    id: string;
    species: FilterableAnimal["species"];
    sex: FilterableAnimal["sex"];
    age_years: number | null;
    birth_date: string | null;
    size: FilterableAnimal["size"];
    breed: string | null;
    color: string | null;
    personality_tags: string[] | null;
    is_vaccinated: boolean;
    is_neutered: boolean | null;
    health_status: FilterableAnimal["health_status"];
    care_difficulty: FilterableAnimal["care_difficulty"];
    suitable_housing: FilterableAnimal["suitable_housing"];
    institution_id: string;
    institution: { city: string | null } | null;
  };

  return ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id,
    species: r.species,
    sex: r.sex,
    age_years: r.age_years,
    birth_date: r.birth_date,
    size: r.size,
    breed: r.breed,
    color: r.color,
    personality_tags: r.personality_tags ?? [],
    is_vaccinated: r.is_vaccinated,
    is_neutered: r.is_neutered,
    health_status: r.health_status,
    care_difficulty: r.care_difficulty,
    suitable_housing: r.suitable_housing,
    institution_id: r.institution_id,
    city: r.institution?.city ?? null,
    search_text: normalize(
      [r.breed ?? "", r.color ?? "", ...(r.personality_tags ?? [])].join(" "),
    ),
  }));
}

async function loadFilterOptions(
  supabase: SupabaseServerClient,
): Promise<FilterOptions> {
  const [animalsRes, institutionsRes] = await Promise.all([
    supabase
      .from("animals")
      .select("name, breed, color, personality_tags")
      .eq("adoption_status", "available")
      .neq("legal_status", "in_protection")
      .limit(500),
    supabase
      .from("institutions")
      .select("id, name, city")
      .eq("is_published", true)
      .order("name"),
  ]);

  const searchSet = new Set<string>();
  const breedSet = new Set<string>();
  const colorSet = new Set<string>();
  const tagSet = new Set<string>();

  for (const a of (animalsRes.data ?? []) as Array<{
    name: string | null;
    breed: string | null;
    color: string | null;
    personality_tags: string[] | null;
  }>) {
    if (a.name) searchSet.add(a.name);
    if (a.breed) {
      searchSet.add(a.breed);
      breedSet.add(a.breed);
    }
    if (a.color) colorSet.add(a.color);
    for (const t of a.personality_tags ?? []) {
      if (t) {
        searchSet.add(t);
        tagSet.add(t);
      }
    }
  }

  const citySet = new Set<string>();
  for (const i of (institutionsRes.data ?? []) as Array<{
    name: string;
    city: string | null;
  }>) {
    if (i.city) citySet.add(i.city);
  }

  return {
    search: Array.from(searchSet).sort((a, b) => a.localeCompare(b, "cs")),
    breeds: Array.from(breedSet).sort((a, b) => a.localeCompare(b, "cs")),
    colors: Array.from(colorSet).sort((a, b) => a.localeCompare(b, "cs")),
    tags: Array.from(tagSet).sort((a, b) => a.localeCompare(b, "cs")),
    cities: Array.from(citySet).sort((a, b) => a.localeCompare(b, "cs")),
    shelters: ((institutionsRes.data ?? []) as Array<{
      id: string;
      name: string;
      city: string | null;
    }>).map((i) => ({
      id: i.id,
      name: i.name,
      city: i.city ?? "",
    })),
  };
}

function countActiveFilters(f: {
  q: string; species: string; sex: string; age: string; size: string;
  breed: string; color: string; vaccinated: string; neutered: string;
  handicap: string; care: string; housing: string;
  city: string; shelter: string; tags: string[];
}): number {
  let n = 0;
  if (f.q) n++;
  if (f.species) n++;
  if (f.sex) n++;
  if (f.age) n++;
  if (f.size) n++;
  if (f.breed) n++;
  if (f.color) n++;
  if (f.vaccinated) n++;
  if (f.neutered) n++;
  if (f.handicap) n++;
  if (f.care) n++;
  if (f.housing) n++;
  if (f.city) n++;
  if (f.shelter) n++;
  n += f.tags.length;
  return n;
}

