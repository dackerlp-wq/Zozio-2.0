import Link from "next/link";

import { AnimalCard, type AnimalCardData } from "@/components/zozio/animal-card";
import { ZozioButton } from "@/components/zozio/button";
import { createClient } from "@/lib/supabase/server";
import { ageLabel, SPECIES_LABEL, SIZE_LABEL } from "@/lib/format";
import type {
  AdoptionStatus,
  AnimalSize,
  CareDifficulty,
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

interface AnimalListRow {
  id: string;
  name: string;
  species: Species;
  breed: string | null;
  age_years: number | null;
  age_months: number | null;
  primary_photo_url: string | null;
  adoption_status: AdoptionStatus;
  is_urgent: boolean;
  long_stay_boost: boolean;
  personality_tags: string[];
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
      "id, name, species, breed, age_years, age_months, primary_photo_url, adoption_status, is_urgent, long_stay_boost, personality_tags, institution:institutions!inner(name, city, is_published)",
      { count: "exact" },
    )
    .eq("adoption_status", "available")
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

  // Age ranges
  if (age === "puppy") {
    query = query.or("age_years.eq.0,age_years.is.null");
  } else if (age === "young") {
    query = query.gte("age_years", 1).lte("age_years", 2);
  } else if (age === "adult") {
    query = query.gte("age_years", 3).lte("age_years", 7);
  } else if (age === "senior") {
    query = query.gte("age_years", 8);
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

  const [{ data, count, error }, filterOptions, allAvailable] = await Promise.all([
    query,
    loadFilterOptions(supabase),
    loadAllAvailableAnimals(supabase),
  ]);

  const facets = computeFacets(allAvailable, filterValues);

  const rows = (data ?? []) as unknown as AnimalListRow[];

  const cards: AnimalCardData[] = rows
    .filter((a) => a.species === "dog" || a.species === "cat" || a.species === "other")
    .map((a) => ({
      id: a.id,
      name: a.name,
      species: a.species as "dog" | "cat" | "other",
      breed: a.breed ?? "—",
      ageLabel: ageLabel(a.age_years, a.age_months),
      city: a.institution?.city ?? "",
      shelterName: a.institution?.name ?? "",
      photoUrl: a.primary_photo_url ?? "",
      status: a.adoption_status as "available" | "reserved" | "adopted",
      isUrgent: a.is_urgent,
      isLongStay: a.long_stay_boost,
      tags: a.personality_tags ?? [],
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
              <>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {cards.map((c) => (
                    <AnimalCard key={c.id} animal={c} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    searchParams={sp}
                  />
                )}
              </>
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
      "id, species, sex, age_years, size, breed, color, personality_tags, is_vaccinated, is_neutered, health_status, care_difficulty, suitable_housing, institution_id, institution:institutions!inner(city, is_published)",
    )
    .eq("adoption_status", "available")
    .eq("institutions.is_published", true)
    .limit(2000);

  type Row = {
    id: string;
    species: FilterableAnimal["species"];
    sex: FilterableAnimal["sex"];
    age_years: number | null;
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

function Pagination({
  page,
  totalPages,
  searchParams,
}: {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const makeHref = (p: number) => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => {
      if (k === "page") return;
      if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
      else if (v) params.set(k, v);
    });
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/adopt?${qs}` : "/adopt";
  };

  return (
    <div className="mt-10 flex items-center justify-center gap-2">
      <ZozioButton
        asChild
        variant="outline"
        size="sm"
        disabled={page <= 1}
        className={page <= 1 ? "pointer-events-none opacity-40" : ""}
      >
        <Link href={makeHref(page - 1)}>← Předchozí</Link>
      </ZozioButton>
      <span className="px-4 text-sm font-semibold text-ink-700">
        Strana {page} z {totalPages}
      </span>
      <ZozioButton
        asChild
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        className={page >= totalPages ? "pointer-events-none opacity-40" : ""}
      >
        <Link href={makeHref(page + 1)}>Další →</Link>
      </ZozioButton>
    </div>
  );
}
