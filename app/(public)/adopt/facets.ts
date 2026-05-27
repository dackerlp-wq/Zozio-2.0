/**
 * Client-friendly filter & facet computation for /adopt.
 * Spočítá pro každou dimenzi filtru počet zvířat IF this option were
 * applied (s ostatními aktivními filtry) — pak UI disablne prázdné možnosti.
 */
import type {
  AnimalSize,
  HealthStatus,
  Sex,
  Species,
} from "@/types/database";

export interface FilterableAnimal {
  id: string;
  species: Species;
  sex: Sex;
  age_years: number | null;
  size: AnimalSize | null;
  breed: string | null;
  color: string | null;
  personality_tags: string[];
  is_vaccinated: boolean;
  is_neutered: boolean | null;
  health_status: HealthStatus;
  institution_id: string;
  city: string | null;
  search_text: string;
}

export interface FilterValues {
  q: string;
  species: string;
  sex: string;
  age: string;
  size: string;
  breed: string;
  color: string;
  tags: string[];
  vaccinated: string;
  neutered: string;
  handicap: string;
  city: string;
  shelter: string;
}

export const EMPTY_FILTERS: FilterValues = {
  q: "",
  species: "",
  sex: "",
  age: "",
  size: "",
  breed: "",
  color: "",
  tags: [],
  vaccinated: "",
  neutered: "",
  handicap: "",
  city: "",
  shelter: "",
};

export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function ageMatches(years: number | null, range: string): boolean {
  if (!range) return true;
  if (range === "puppy") return years === 0 || years === null;
  if (range === "young") return years !== null && years >= 1 && years <= 2;
  if (range === "adult") return years !== null && years >= 3 && years <= 7;
  if (range === "senior") return years !== null && years >= 8;
  return true;
}

export function matchesFilter(
  a: FilterableAnimal,
  f: FilterValues,
): boolean {
  if (f.species && a.species !== f.species) return false;
  if (f.sex && a.sex !== f.sex) return false;
  if (!ageMatches(a.age_years, f.age)) return false;
  if (f.size && a.size !== f.size) return false;
  if (
    f.breed &&
    !normalize(a.breed ?? "").includes(normalize(f.breed))
  )
    return false;
  if (
    f.color &&
    !normalize(a.color ?? "").includes(normalize(f.color))
  )
    return false;
  if (
    f.city &&
    !normalize(a.city ?? "").includes(normalize(f.city))
  )
    return false;
  if (f.shelter && a.institution_id !== f.shelter) return false;
  if (f.tags.length > 0) {
    for (const t of f.tags) {
      if (!a.personality_tags.includes(t)) return false;
    }
  }
  if (f.vaccinated === "yes" && !a.is_vaccinated) return false;
  if (f.vaccinated === "no" && a.is_vaccinated) return false;
  if (f.neutered === "yes" && a.is_neutered !== true) return false;
  if (f.neutered === "no" && a.is_neutered !== false) return false;
  if (f.handicap === "yes" && a.health_status !== "special_needs") return false;
  if (f.handicap === "no" && a.health_status === "special_needs") return false;
  if (f.q) {
    const q = normalize(f.q);
    if (!a.search_text.includes(q)) return false;
  }
  return true;
}

export interface Facets {
  species: Record<string, number>;
  sex: Record<string, number>;
  age: Record<string, number>;
  size: Record<string, number>;
  breed: Record<string, number>;
  color: Record<string, number>;
  tags: Record<string, number>;
  vaccinated: { yes: number; no: number };
  neutered: { yes: number; no: number };
  handicap: { yes: number; no: number };
  shelter: Record<string, number>;
  city: Record<string, number>;
}

/**
 * Pro každou dimenzi: vyhodnoť animals s VŠEMI ostatními filtry aktivními
 * (tj. without this dimension), pak spočítej počty per hodnota.
 */
export function computeFacets(
  animals: FilterableAnimal[],
  filters: FilterValues,
): Facets {
  const without = <K extends keyof FilterValues>(dim: K): FilterValues =>
    ({ ...filters, [dim]: dim === "tags" ? [] : "" }) as FilterValues;

  const countBy = (
    filtersWithoutDim: FilterValues,
    getValue: (a: FilterableAnimal) => string | string[] | null,
  ): Record<string, number> => {
    const counts: Record<string, number> = {};
    for (const a of animals) {
      if (!matchesFilter(a, filtersWithoutDim)) continue;
      const v = getValue(a);
      if (Array.isArray(v)) {
        for (const item of v) if (item) counts[item] = (counts[item] ?? 0) + 1;
      } else if (v) {
        counts[v] = (counts[v] ?? 0) + 1;
      }
    }
    return counts;
  };

  const triCount = (
    filtersWithoutDim: FilterValues,
    pred: (a: FilterableAnimal) => boolean,
  ): { yes: number; no: number } => {
    let yes = 0;
    let no = 0;
    for (const a of animals) {
      if (!matchesFilter(a, filtersWithoutDim)) continue;
      if (pred(a)) yes++;
      else no++;
    }
    return { yes, no };
  };

  const ageFacet = (): Record<string, number> => {
    const acc: Record<string, number> = {
      puppy: 0,
      young: 0,
      adult: 0,
      senior: 0,
    };
    const fwd = without("age");
    for (const a of animals) {
      if (!matchesFilter(a, fwd)) continue;
      const y = a.age_years;
      if (y === 0 || y === null) acc.puppy++;
      else if (y >= 1 && y <= 2) acc.young++;
      else if (y >= 3 && y <= 7) acc.adult++;
      else if (y >= 8) acc.senior++;
    }
    return acc;
  };

  return {
    species: countBy(without("species"), (a) => a.species),
    sex: countBy(without("sex"), (a) => a.sex),
    age: ageFacet(),
    size: countBy(without("size"), (a) => a.size ?? null),
    breed: countBy(without("breed"), (a) => a.breed),
    color: countBy(without("color"), (a) => a.color),
    tags: countBy(without("tags"), (a) => a.personality_tags),
    vaccinated: triCount(without("vaccinated"), (a) => a.is_vaccinated),
    neutered: triCount(without("neutered"), (a) => a.is_neutered === true),
    handicap: triCount(
      without("handicap"),
      (a) => a.health_status === "special_needs",
    ),
    shelter: countBy(without("shelter"), (a) => a.institution_id),
    city: countBy(without("city"), (a) => a.city),
  };
}
