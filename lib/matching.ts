/**
 * Sdílené párovací skóre adoptant ↔ zvíře (client-safe, bez DB).
 *
 * Deterministické jádro životních dimenzí (děti, jiná zvířata, zahrada,
 * bydlení, zkušenost) SDÍLÍ s adminem přes `scoreApplication`
 * (lib/animal-adoption-match). Navíc přidává adoptantské preference z kvízu
 * (druh, velikost, aktivita, ochota ke speciální péči). Výsledek = % shody +
 * strukturované důvody (✓ sedí / ! pozor). AI je nepovinné doladění (jinde).
 */
import { scoreApplication, type ApplicantData } from "@/lib/animal-adoption-match";
import type {
  AdopterExperience,
  AnimalSize,
  CareDifficulty,
  Compatibility,
  EnergyLevel,
  HealthStatus,
  Species,
  SuitableHousing,
} from "@/types/database";

// --- Odpovědi kvízu --------------------------------------------------------

export interface AdopterPreferences {
  species?: "dog" | "cat" | "rabbit" | "any";
  housing?: "apartment" | "house"; // dům = i se zahradou
  has_garden?: boolean;
  activity?: "calm" | "balanced" | "active" | "any";
  experience?: "none" | "some" | "experienced";
  has_children?: boolean;
  has_pets?: boolean;
  size?: "small" | "medium" | "large" | "any";
  special_care_ok?: boolean;
}

/** Atributy zvířete potřebné pro skórování (z publikované karty). */
export interface MatchAnimal {
  species: Species;
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
}

export interface MatchReason {
  ok: boolean;
  text: string;
  severity: "high" | "normal";
}

export interface MatchResult {
  score: number;
  tone: "high" | "mid" | "low";
  reasons: MatchReason[];
  /** Jeden hlavní důvod do karty (preferuje pozitivní u vysoké shody, jinak varování). */
  headline: MatchReason | null;
  /** Má zvíře vyplněno dost klíčových údajů, aby šlo skóre brát vážně? */
  enoughInfo: boolean;
  /** Důležité údaje, které u zvířete chybí (lidsky pojmenované). */
  missing: string[];
}

// --- Skórování -------------------------------------------------------------

const SPECIES_LABEL: Record<string, string> = {
  dog: "pes",
  cat: "kočka",
  rabbit: "králík",
  other: "jiné",
};
const SIZE_LABEL: Record<string, string> = {
  small: "malé",
  medium: "střední",
  large: "velké",
  xlarge: "velmi velké",
};

function prefsToApplicant(p: AdopterPreferences): ApplicantData {
  return {
    housing_type: p.housing === "house" ? "house" : p.housing === "apartment" ? "apartment" : "",
    has_garden: p.has_garden === true,
    has_children: p.has_children === true,
    has_pets: p.has_pets === true,
    experience: p.experience ?? "",
  };
}

export function scoreAdopterMatch(prefs: AdopterPreferences, animal: MatchAnimal): MatchResult {
  const hasSpecialNeeds =
    animal.health_status === "special_needs" || animal.care_difficulty === "high";

  // 1) Sdílené jádro s adminem (děti / jiná zvířata / zahrada / bydlení / zkušenost).
  const base = scoreApplication(prefsToApplicant(prefs), {
    good_with_children: animal.good_with_children,
    good_with_dogs: animal.good_with_dogs,
    good_with_cats: animal.good_with_cats,
    needs_garden: animal.needs_garden,
    suitable_housing: animal.suitable_housing,
    adopter_experience: animal.adopter_experience,
    care_difficulty: animal.care_difficulty,
    hasSpecialNeeds,
  });

  let totalW = base.totalWeight;
  let metW = base.metWeight;
  const reasons: MatchReason[] = base.chips.map((c) => ({
    ok: c.ok,
    text: c.label,
    severity: c.severity,
  }));
  const missing: string[] = [];

  const add = (weight: number, ok: boolean, okText: string, noText: string, severity: "high" | "normal") => {
    totalW += weight;
    if (ok) metW += weight;
    reasons.push({ ok, text: ok ? okText : noText, severity });
  };

  const isKnown = (c: Compatibility) => c !== "unknown";

  // 2) Druh — jasná preference (druh je vždy vyplněný; váží nejvíc).
  if (prefs.species && prefs.species !== "any") {
    add(
      4,
      animal.species === prefs.species,
      `${SPECIES_LABEL[animal.species] ?? animal.species} — přesně co hledáš`,
      `Jiný druh, než hledáš (${SPECIES_LABEL[animal.species] ?? animal.species})`,
      "high",
    );
  }

  // 3) Děti — jako člověk: ocením potvrzenou snášenlivost, neshodu řeší base,
  //    a když je to „neznámo" a děti doma máš, je to chybějící důležitý údaj.
  if (prefs.has_children) {
    if (animal.good_with_children === "yes") {
      add(2, true, "Vychází dobře s dětmi", "", "normal");
    } else if (animal.good_with_children === "unknown") {
      missing.push("snášenlivost s dětmi");
    }
  }

  // 4) Jiná zvířata doma.
  if (prefs.has_pets) {
    const dogsK = isKnown(animal.good_with_dogs);
    const catsK = isKnown(animal.good_with_cats);
    if (animal.good_with_dogs === "yes" || animal.good_with_cats === "yes") {
      add(1.5, true, "Vychází s jinými zvířaty", "", "normal");
    } else if (!dogsK && !catsK) {
      missing.push("snášenlivost s jinými zvířaty");
    }
  }

  // 5) Aktivita vs. energie zvířete.
  if (prefs.activity && prefs.activity !== "any") {
    if (animal.energy_level) {
      const wanted: Record<string, EnergyLevel[]> = {
        calm: ["low", "medium"],
        balanced: ["low", "medium", "high"],
        active: ["medium", "high"],
      };
      const ok = wanted[prefs.activity]?.includes(animal.energy_level) ?? true;
      add(
        2,
        ok,
        "Tempo a energie ti sednou",
        animal.energy_level === "high" ? "Aktivní — chce hodně pohybu" : "Klidnější, než hledáš",
        "normal",
      );
    } else {
      missing.push("povaha a energie");
    }
  }

  // 6) Velikost.
  if (prefs.size && prefs.size !== "any") {
    if (animal.size) {
      const sizeMatch =
        animal.size === prefs.size || (prefs.size === "large" && animal.size === "xlarge");
      add(
        1,
        sizeMatch,
        `Velikost podle představ (${SIZE_LABEL[animal.size]})`,
        `Jiná velikost (${SIZE_LABEL[animal.size]})`,
        "normal",
      );
    } else {
      missing.push("velikost");
    }
  }

  // 7) Ochota ke speciální péči.
  if (hasSpecialNeeds) {
    add(
      3,
      prefs.special_care_ok === true,
      "Zvládneš speciální péči",
      "Vyžaduje speciální péči",
      "high",
    );
  }

  // --- Úplnost profilu: kolik klíčových údajů je vůbec vyplněno? ---
  const knownKeyFields = [
    isKnown(animal.good_with_children),
    isKnown(animal.good_with_dogs) || isKnown(animal.good_with_cats),
    !!animal.energy_level,
    !!animal.size,
  ].filter(Boolean).length;
  const enoughInfo = knownKeyFields >= 2;

  // Skóre z toho, co víme; za každý chybějící důležitý údaj −10 % (min 0).
  const rawScore = totalW === 0 ? 100 : Math.round((metW / totalW) * 100);
  const score = Math.max(0, rawScore - missing.length * 10);
  const tone: MatchResult["tone"] = score >= 75 ? "high" : score >= 45 ? "mid" : "low";

  // Hlavní důvod: u vysoké shody pozitivní, jinak nejzávažnější varování.
  const firstFlag = reasons.find((r) => !r.ok && r.severity === "high") ?? reasons.find((r) => !r.ok);
  const firstOk = reasons.find((r) => r.ok);
  const headline = tone === "high" ? (firstOk ?? firstFlag ?? null) : (firstFlag ?? firstOk ?? null);

  return { score, tone, reasons, headline, enoughInfo, missing };
}

// --- Definice kvízu --------------------------------------------------------

export interface QuizOption {
  value: string;
  label: string;
  emoji?: string;
}
export interface QuizQuestion {
  id: keyof AdopterPreferences;
  title: string;
  hint?: string;
  options: QuizOption[];
  /** Jak namapovat zvolenou hodnotu na pole preferencí. */
  parse?: (value: string) => Partial<AdopterPreferences>;
}

export const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: "species",
    title: "Koho hledáš?",
    options: [
      { value: "dog", label: "Psa", emoji: "🐕" },
      { value: "cat", label: "Kočku", emoji: "🐈" },
      { value: "rabbit", label: "Králíka", emoji: "🐰" },
      { value: "any", label: "Jsem otevřený/á", emoji: "✨" },
    ],
  },
  {
    id: "housing",
    title: "Kde bydlíš?",
    options: [
      { value: "apartment", label: "Byt", emoji: "🏢" },
      { value: "house", label: "Dům se zahradou", emoji: "🏡" },
    ],
    parse: (v) => ({ housing: v as "apartment" | "house", has_garden: v === "house" }),
  },
  {
    id: "activity",
    title: "Kolik máš času a energie?",
    hint: "Jak aktivní život s parťákem chceš?",
    options: [
      { value: "calm", label: "Spíš klid a pohoda", emoji: "🛋️" },
      { value: "balanced", label: "Vyvážené tempo", emoji: "🚶" },
      { value: "active", label: "Hodně pohybu a akce", emoji: "🏃" },
    ],
  },
  {
    id: "experience",
    title: "Máš zkušenosti se zvířaty?",
    options: [
      { value: "none", label: "Jsem začátečník", emoji: "🌱" },
      { value: "some", label: "Něco už mám za sebou", emoji: "👍" },
      { value: "experienced", label: "Jsem zkušený/á", emoji: "🎓" },
    ],
  },
  {
    id: "has_children",
    title: "Žijí s tebou děti?",
    options: [
      { value: "yes", label: "Ano", emoji: "🧒" },
      { value: "no", label: "Ne", emoji: "🙅" },
    ],
    parse: (v) => ({ has_children: v === "yes" }),
  },
  {
    id: "has_pets",
    title: "Máš doma jiná zvířata?",
    options: [
      { value: "yes", label: "Ano", emoji: "🐾" },
      { value: "no", label: "Ne", emoji: "🚫" },
    ],
    parse: (v) => ({ has_pets: v === "yes" }),
  },
  {
    id: "size",
    title: "Jaká velikost ti vyhovuje?",
    options: [
      { value: "small", label: "Malé", emoji: "🐭" },
      { value: "medium", label: "Střední", emoji: "🐕" },
      { value: "large", label: "Velké", emoji: "🐺" },
      { value: "any", label: "Nezáleží", emoji: "✨" },
    ],
  },
  {
    id: "special_care_ok",
    title: "Vzal/a by sis zvíře se speciální péčí?",
    hint: "Senioři, handicap nebo chronická léčba potřebují víc.",
    options: [
      { value: "yes", label: "Ano, klidně", emoji: "💛" },
      { value: "no", label: "Radši ne", emoji: "🤔" },
    ],
    parse: (v) => ({ special_care_ok: v === "yes" }),
  },
];
