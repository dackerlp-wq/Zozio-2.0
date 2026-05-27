import Link from "next/link";

import { AnimalCard, type AnimalCardData } from "@/components/zozio/animal-card";
import { ZozioButton } from "@/components/zozio/button";
import { createClient } from "@/lib/supabase/server";
import { ageLabel, SPECIES_LABEL, SIZE_LABEL } from "@/lib/format";
import type { AdoptionStatus, Species } from "@/types/database";

import { AdoptFilters } from "./filters";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function loadSuggestions(supabase: SupabaseServerClient) {
  const [animals, institutions] = await Promise.all([
    supabase
      .from("animals")
      .select("name, breed, personality_tags")
      .eq("adoption_status", "available")
      .limit(200),
    supabase
      .from("institutions")
      .select("city")
      .eq("is_published", true)
      .not("city", "is", null),
  ]);

  const searchSet = new Set<string>();
  for (const a of (animals.data ?? []) as Array<{
    name: string | null;
    breed: string | null;
    personality_tags: string[] | null;
  }>) {
    if (a.name) searchSet.add(a.name);
    if (a.breed) searchSet.add(a.breed);
    for (const t of a.personality_tags ?? []) if (t) searchSet.add(t);
  }

  const citySet = new Set<string>();
  for (const i of (institutions.data ?? []) as Array<{ city: string | null }>) {
    if (i.city) citySet.add(i.city);
  }

  return {
    search: Array.from(searchSet).sort((a, b) => a.localeCompare(b, "cs")),
    cities: Array.from(citySet).sort((a, b) => a.localeCompare(b, "cs")),
  };
}

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

const PAGE_SIZE = 12;

interface PageProps {
  searchParams: Promise<{
    q?: string;
    species?: string;
    size?: string;
    city?: string;
    page?: string;
  }>;
}

export const metadata = {
  title: "Adoptuj zvíře — Zozio",
  description:
    "Procházej tisíce zvířat z útulků v ČR a SK. Filtruj podle druhu, velikosti, města a najdi svého parťáka.",
};

export default async function AdoptPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const species = sp.species ?? "";
  const size = sp.size ?? "";
  const city = sp.city?.trim() ?? "";
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

  if (species) query = query.eq("species", species);
  if (size) query = query.eq("size", size);
  if (city) query = query.ilike("institutions.city", `%${city}%`);
  if (q) {
    const tsq = q
      .split(/\s+/)
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

  const [{ data, count, error }, suggestions] = await Promise.all([
    query,
    loadSuggestions(supabase),
  ]);

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
  const hasFilters = Boolean(q || species || size || city);

  return (
    <div className="bg-background">
      {/* Header */}
      <section className="border-b border-ink-900/8 bg-cream-warm">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16">
          <div className="space-y-3">
            <div className="font-mono text-xs uppercase tracking-wider text-meadow-700">
              Katalog
            </div>
            <h1 className="font-display text-4xl font-bold tracking-tight text-ink-900 md:text-6xl">
              {q
                ? `Hledáš „${q}"`
                : species && SPECIES_LABEL[species]
                  ? `${SPECIES_LABEL[species]}i hledající domov`
                  : "Najdi svého parťáka"}
            </h1>
            <p className="text-lg text-ink-600">
              {count !== null
                ? `${count.toLocaleString("cs-CZ")} zvířat čeká právě teď`
                : "Načítám…"}
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <AdoptFilters
          initialQ={q}
          initialSpecies={species}
          initialSize={size}
          initialCity={city}
          searchSuggestions={suggestions.search}
          citySuggestions={suggestions.cities}
        />

        {error && (
          <div className="mt-8 rounded-2xl bg-peach-100 p-4 text-sm text-terracotta-600 ring-1 ring-inset ring-peach-300">
            Chyba při načítání: {error.message}
          </div>
        )}

        {cards.length === 0 ? (
          <div className="mt-12 rounded-3xl bg-cream-warm p-12 text-center">
            <div className="text-4xl">🐾</div>
            <h2 className="mt-4 font-display text-2xl font-semibold text-ink-900">
              Nic jsme nenašli
            </h2>
            <p className="mt-2 text-ink-600">
              {hasFilters
                ? "Zkus jiné filtry nebo méně přesné vyhledávání."
                : "Zatím tu nejsou žádná zvířata."}
            </p>
            {hasFilters && (
              <ZozioButton asChild variant="outline" size="md" className="mt-6">
                <Link href="/adopt">Vyčistit filtry</Link>
              </ZozioButton>
            )}
          </div>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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

        {/* Active filter summary */}
        {hasFilters && cards.length > 0 && (
          <div className="mt-8 flex flex-wrap items-center gap-2 text-sm text-ink-600">
            <span>Aktivní filtry:</span>
            {species && (
              <FilterChip>{SPECIES_LABEL[species] ?? species}</FilterChip>
            )}
            {size && <FilterChip>{SIZE_LABEL[size] ?? size}</FilterChip>}
            {city && <FilterChip>📍 {city}</FilterChip>}
            {q && <FilterChip>„{q}"</FilterChip>}
            <Link
              href="/adopt"
              className="ml-2 text-sm font-semibold text-meadow-700 hover:underline"
            >
              vyčistit vše
            </Link>
          </div>
        )}
      </section>
    </div>
  );
}

function FilterChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-meadow-100 px-3 py-1 text-sm font-semibold text-meadow-700">
      {children}
    </span>
  );
}

function Pagination({
  page,
  totalPages,
  searchParams,
}: {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
}) {
  const makeHref = (p: number) => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v && k !== "page") params.set(k, v);
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
