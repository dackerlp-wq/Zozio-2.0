/**
 * Skríning žádosti o adopci — bez DB.
 *
 * Porovná strukturovaná data žadatele (`applicant_data` z veřejného formuláře)
 * s požadavky zvířete (vhodnost k dětem / psům / kočkám, potřeba zahrady,
 * vhodné bydlení, nutná zkušenost / speciální potřeby). Vrací % shody,
 * pozitivní chipy a červené vlajky. Počítají se jen kritéria, která u zvířete
 * dávají smysl — když zvíře nemá zvláštní nároky, shoda je 100 %.
 */
import type {
  AdopterExperience,
  CareDifficulty,
  Compatibility,
  SuitableHousing,
} from "@/types/database";

export interface ApplicantData {
  housing_type?: string; // "apartment" | "house" | "other" | ""
  experience?: string; // "none" | "some" | "experienced" | ""
  has_garden?: boolean;
  has_children?: boolean;
  has_pets?: boolean;
}

export interface AnimalAdoptionNeeds {
  good_with_children: Compatibility;
  good_with_dogs: Compatibility;
  good_with_cats: Compatibility;
  needs_garden: boolean | null;
  suitable_housing: SuitableHousing | null;
  adopter_experience: AdopterExperience;
  care_difficulty: CareDifficulty | null;
  /** Aktivní léčba nebo chronický stav → potřeba zkušenějšího adoptanta. */
  hasSpecialNeeds: boolean;
}

export interface MatchChip {
  label: string;
  ok: boolean;
  /** high = blokující/zásadní neshoda, normal = doplňková. */
  severity: "high" | "normal";
}

export interface AdoptionMatch {
  score: number;
  tone: "high" | "mid" | "low";
  chips: MatchChip[];
  flags: string[];
  /** Souhrnné váhy kritérií — umožní složit skóre se sdílenými dimenzemi (lib/matching). */
  totalWeight: number;
  metWeight: number;
}

function parseApplicantData(raw: unknown): ApplicantData {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    housing_type: typeof o.housing_type === "string" ? o.housing_type : "",
    experience: typeof o.experience === "string" ? o.experience : "",
    has_garden: o.has_garden === true,
    has_children: o.has_children === true,
    has_pets: o.has_pets === true,
  };
}

export function scoreApplication(
  raw: unknown,
  needs: AnimalAdoptionNeeds,
): AdoptionMatch {
  const d = parseApplicantData(raw);
  const chips: MatchChip[] = [];
  const flags: string[] = [];
  let totalW = 0;
  let metW = 0;

  const add = (
    applicable: boolean,
    ok: boolean,
    okLabel: string,
    flagLabel: string,
    weight: number,
    severity: "high" | "normal",
  ) => {
    if (!applicable) return;
    totalW += weight;
    if (ok) metW += weight;
    chips.push({ label: ok ? okLabel : flagLabel, ok, severity });
    if (!ok) flags.push(flagLabel);
  };

  // Děti — zvíře, které děti nesnáší, nepatří do domácnosti s dětmi.
  add(
    needs.good_with_children === "no",
    d.has_children !== true,
    "bez dětí",
    "děti v domácnosti",
    3,
    "high",
  );

  // Jiná zvířata — nesnáší psy/kočky → nesmí být u jiných zvířat (neověřeno).
  const noOtherAnimals = needs.good_with_dogs === "no" || needs.good_with_cats === "no";
  add(
    noOtherAnimals,
    d.has_pets !== true,
    "bez jiných zvířat",
    "jiná zvířata (neověřeno)",
    2,
    "normal",
  );

  // Zahrada — vyžaduje-li zvíře zahradu.
  add(
    needs.needs_garden === true,
    d.has_garden === true,
    "zahrada",
    "chybí zahrada",
    2,
    "normal",
  );

  // Bydlení — vhodné jen pro dům → byt je neshoda.
  add(
    needs.suitable_housing === "house",
    d.housing_type === "house" || d.housing_type === "other",
    "vhodné bydlení",
    "malý byt",
    2,
    "normal",
  );

  // Zkušenost — jen zkušený adoptant / náročná péče / speciální potřeby.
  const needsExperience =
    needs.adopter_experience === "experienced_only" ||
    needs.care_difficulty === "high" ||
    needs.hasSpecialNeeds;
  add(
    needsExperience,
    d.experience === "experienced" || d.experience === "some",
    "zkušenost",
    "bez zkušenosti",
    2,
    "high",
  );

  const score = totalW === 0 ? 100 : Math.round((metW / totalW) * 100);
  const tone: AdoptionMatch["tone"] = score >= 75 ? "high" : score >= 45 ? "mid" : "low";
  return { score, tone, chips, flags, totalWeight: totalW, metWeight: metW };
}
