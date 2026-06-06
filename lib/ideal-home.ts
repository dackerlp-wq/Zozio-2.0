/**
 * „Ideální domov" — deterministické mapování strukturovaných atributů zvířete
 * na lidské věty (Hodí se k / Nehodí se k). Stejná data, jaká používá
 * lib/matching, takže je to vždy konzistentní s AI shodou. Client-safe.
 *
 * AI je nepovinná nadstavba (jinde) — když není, tato verze plně stačí.
 */
import type {
  AdopterExperience,
  AnimalSize,
  CareDifficulty,
  Compatibility,
  EnergyLevel,
  HealthStatus,
  SuitableHousing,
} from "@/types/database";

export interface IdealHomeInput {
  energy_level: EnergyLevel | null;
  care_difficulty: CareDifficulty | null;
  adopter_experience: AdopterExperience;
  suitable_housing: SuitableHousing | null;
  needs_garden: boolean | null;
  good_with_children: Compatibility;
  good_with_dogs: Compatibility;
  good_with_cats: Compatibility;
  health_status: HealthStatus;
  size: AnimalSize | null;
}

export interface IdealHome {
  fits: string[];
  notFits: string[];
}

export function idealHome(a: IdealHomeInput): IdealHome {
  const fits: string[] = [];
  const notFits: string[] = [];

  const experienced = a.adopter_experience === "experienced_only" || a.care_difficulty === "high";
  const specialNeeds = a.health_status === "special_needs" || a.care_difficulty === "high";

  // Energie / tempo života.
  if (a.energy_level === "high") {
    fits.push("Aktivní páníček nebo rodina");
    notFits.push("Pasivní domácnost bez pohybu");
  } else if (a.energy_level === "low") {
    fits.push("Klidná, vyrovnaná domácnost");
    notFits.push("Hektické prostředí s neustálým ruchem");
  } else if (a.energy_level === "medium") {
    fits.push("Vyvážené tempo života");
  }

  // Bydlení.
  if (a.suitable_housing === "house" || a.needs_garden === true) {
    fits.push("Dům se zahradou");
    notFits.push("Malý byt bez možnosti výběhu");
  } else if (a.suitable_housing === "apartment") {
    fits.push("Klidný byt");
  } else if (a.suitable_housing === "both") {
    fits.push("Byt i dům");
  }

  // Zkušenost.
  if (experienced) {
    fits.push("Zkušenější chovatel");
    notFits.push("Úplný začátečník bez času na výchovu");
  } else if (a.adopter_experience === "beginner_ok" && a.care_difficulty === "easy") {
    fits.push("Vhodné i pro první zvíře");
  }

  // Děti.
  if (a.good_with_children === "yes") {
    fits.push("Domácnost s dětmi");
  } else if (a.good_with_children === "no") {
    notFits.push("Domácnost s malými dětmi");
  }

  // Jiná zvířata.
  if (a.good_with_dogs === "yes" || a.good_with_cats === "yes") {
    fits.push("Domov s dalšími zvířaty");
  }
  if (a.good_with_dogs === "no" && a.good_with_cats === "no") {
    notFits.push("K jiným psům ani kočkám");
  } else if (a.good_with_dogs === "no") {
    notFits.push("K jiným psům");
  } else if (a.good_with_cats === "no") {
    notFits.push("Ke kočkám");
  }

  // Speciální péče.
  if (specialNeeds) {
    fits.push("Trpělivý člověk ochotný k péči navíc");
  }

  // Velikost (jen pro představu prostoru).
  if (a.size === "xlarge") {
    notFits.push("Stísněný prostor — je to velký pes");
  }

  // Fallbacky, ať nikdy nejsou prázdné.
  if (fits.length === 0) fits.push("Milující domov, kde nebude sám");
  if (notFits.length === 0) notFits.push("Lhostejnost a nedostatek času");

  // Dedup + limit.
  return {
    fits: dedupe(fits).slice(0, 5),
    notFits: dedupe(notFits).slice(0, 5),
  };
}

function dedupe(arr: string[]): string[] {
  return Array.from(new Set(arr));
}
