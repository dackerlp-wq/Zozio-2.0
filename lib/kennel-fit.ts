/**
 * Doporučení vhodnosti kotce pro zvíře — bez DB.
 *
 * NIKDY nefiltruje: vrací úroveň doporučení + důvody. Rozhodnutí je vždy na
 * uživateli (nabízíme všechny volné kotce). Sdílené mezi záložkou Ustájení
 * karty zvířete a `/admin/kennels`.
 */
import type { Compatibility, KennelKind, Sex, Species } from "@/types/database";

export type KennelFitLevel = "recommended" | "less_suitable" | "neutral";

export interface FitAnimal {
  species: Species;
  sex: Sex;
  good_with_dogs: Compatibility;
  good_with_cats: Compatibility;
}

export interface FitKennel {
  kind: KennelKind;
  species_allowed: Species[];
  is_maternity: boolean;
}

export interface FitOccupant {
  species: Species;
  sex: Sex;
}

export interface KennelFit {
  level: KennelFitLevel;
  reasons: string[];
}

const SPECIES_LABEL: Record<Species, string> = {
  dog: "psa",
  cat: "kočku",
  rabbit: "králíka",
  other: "jiný druh",
};

/**
 * Spočítá doporučení. `less_suitable` = je důvod ke kontrole (uživatel může
 * přesto vybrat). `recommended` = bez varování a sedí druh. `neutral` jinak.
 */
export function kennelFit(
  animal: FitAnimal,
  kennel: FitKennel,
  occupants: FitOccupant[],
): KennelFit {
  const reasons: string[] = [];

  // Povolený druh kotce.
  const speciesOk =
    kennel.species_allowed.length === 0 || kennel.species_allowed.includes(animal.species);
  if (!speciesOk) {
    reasons.push(`Kotec není určen pro ${SPECIES_LABEL[animal.species]}`);
  }

  // Jiný druh mezi obyvateli.
  const otherSpecies = occupants.filter((o) => o.species !== animal.species);
  if (otherSpecies.length > 0) {
    reasons.push("V kotci je jiný druh zvířete");
  }

  // Snášenlivost s aktuálními obyvateli (z údajů zvířete).
  const hasDogs = occupants.some((o) => o.species === "dog");
  const hasCats = occupants.some((o) => o.species === "cat");
  if (hasDogs && animal.good_with_dogs === "no") {
    reasons.push("Zvíře nesnáší jiné psy");
  }
  if (hasCats && animal.good_with_cats === "no") {
    reasons.push("Zvíře nesnáší kočky");
  }

  // Smíšené pohlaví (jen u stejného druhu, kde to dává smysl).
  const sameSpecies = occupants.filter((o) => o.species === animal.species);
  if (
    animal.sex !== "unknown" &&
    sameSpecies.some((o) => o.sex !== "unknown" && o.sex !== animal.sex)
  ) {
    reasons.push("Smíšené pohlaví — zkontroluj snášenlivost");
  }

  if (reasons.length > 0) return { level: "less_suitable", reasons };

  // Bez varování: pokud sedí druh, doporuč; jinak neutrál.
  const positives: string[] = [];
  if (speciesOk && kennel.species_allowed.length > 0) {
    positives.push("Vhodný druh");
  }
  if (occupants.length === 0) {
    positives.push("Volný kotec");
  } else {
    positives.push("Kompatibilní s aktuálními obyvateli");
  }
  return { level: speciesOk ? "recommended" : "neutral", reasons: positives };
}
