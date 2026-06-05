/**
 * Pomocné funkce pěstounské péče — bez DB.
 * Skóre vhodnosti pěstouna vůči požadavkům zvířete (kapacita + štítky)
 * s ohledem na důležitost jednotlivých kritérií.
 */
import type { AnimalSize, Compatibility, Species } from "@/types/database";

export function isCarerFull(capacity: number | null, activePlacements: number): boolean {
  return capacity != null && activePlacements >= capacity;
}

export type CriterionKind = "require" | "exclude";

/**
 * Důležitost kritéria:
 *  - `block`     = blokující. Nesplnění vylučuje pěstouna (např. nebere kočky,
 *                  nebo má jiná zvířata u zvířete, které je nesnáší).
 *  - `important` = důležité (léčba, pooperační péče, věk…).
 *  - `nice`      = doplňkové (zahrada…).
 */
export type CriterionSeverity = "block" | "important" | "nice";

export interface Criterion {
  key: string; // klíč štítku z `FOSTER_TAGS`
  kind: CriterionKind; // require = pěstoun MÁ mít; exclude = pěstoun NEMÁ mít
  severity: CriterionSeverity;
}

export interface CriterionResult extends Criterion {
  ok: boolean;
}

export interface CarerEval {
  score: number;
  /** Některé blokující kritérium není splněné → pěstoun je nevhodný. */
  blocked: boolean;
  tone: "high" | "mid" | "block" | "full";
  results: CriterionResult[];
}

const SEVERITY_WEIGHT: Record<CriterionSeverity, number> = {
  block: 3,
  important: 2,
  nice: 1,
};

/**
 * Vyhodnotí pěstouna proti kritériím zvířete. Skóre 0–100 kombinuje vážené
 * splnění kritérií (max 70 %) a volnou kapacitu (30 %). Kritéria s vyšší
 * důležitostí mají větší váhu. Bez kritérií: dostupný 90 %, plný 50 %.
 * `blocked` je true, když některé blokující kritérium není splněné — takový
 * pěstoun se řadí na konec a badge ho označí jako nevhodného.
 */
export function evaluateCarer(
  carerTags: string[] | null,
  criteria: Criterion[],
  full: boolean,
): CarerEval {
  const tags = new Set(carerTags ?? []);
  const results: CriterionResult[] = criteria.map((c) => ({
    ...c,
    ok: c.kind === "require" ? tags.has(c.key) : !tags.has(c.key),
  }));
  const blocked = results.some((r) => r.severity === "block" && !r.ok);

  let score: number;
  if (criteria.length === 0) {
    score = full ? 50 : 90;
  } else {
    const totalW = criteria.reduce((s, c) => s + SEVERITY_WEIGHT[c.severity], 0);
    const metW = results.reduce((s, r) => s + (r.ok ? SEVERITY_WEIGHT[r.severity] : 0), 0);
    const tagScore = (metW / totalW) * 70;
    const capScore = full ? 0 : 30;
    score = Math.round(tagScore + capScore);
  }

  const tone: CarerEval["tone"] = full ? "full" : blocked ? "block" : score >= 80 ? "high" : "mid";
  return { score, blocked, tone, results };
}

/**
 * Vstup pro stavění párovacích kritérií ze zvířete. Odvozené signály
 * (`ageMonths`, `hasActiveMed`, `hasConditions`) si volající spočítá z dat.
 */
export interface CriteriaAnimal {
  species: Species;
  size: AnimalSize | null;
  ageMonths: number | null;
  hasActiveMed: boolean;
  hasConditions: boolean;
  needs_garden: boolean | null;
  good_with_children: Compatibility | null;
  good_with_dogs: Compatibility | null;
  good_with_cats: Compatibility | null;
}

/**
 * Sestaví párovací kritéria z údajů zvířete. Sdíleno mezi kartou zvířete
 * (záložka Pěstoun) a detailem pěstouna („Umístit zvíře") — stejné %.
 */
export function buildAnimalCriteria(a: CriteriaAnimal): Criterion[] {
  const criteria: Criterion[] = [];
  const req = (key: string, severity: CriterionSeverity) =>
    criteria.push({ key, kind: "require", severity });
  const exc = (key: string, severity: CriterionSeverity) =>
    criteria.push({ key, kind: "exclude", severity });

  // Druh & velikost = blokující (kočku nenabídnu pěstounovi bez koček).
  if (a.species === "dog")
    req(a.size === "large" || a.size === "xlarge" ? "big_dogs" : "small_dogs", "block");
  if (a.species === "cat") req("cats", "block");
  if (a.species === "rabbit" || a.species === "other") req("small_animals", "block");
  // Péče = důležité.
  if (a.ageMonths != null && a.ageMonths < 6) req("puppies", "important");
  if (a.hasActiveMed) req("meds", "important");
  if (a.hasConditions) req("post_op", "important");
  // Prostředí — ověřitelné ze snášenlivosti a potřeby zahrady.
  if (a.needs_garden === true) req("garden", "nice");
  if (a.good_with_children === "no") {
    req("no_children", "important");
    exc("children", "block"); // nesnáší děti → domácnost s dětmi je vyloučená
  }
  if (a.good_with_dogs === "no" || a.good_with_cats === "no") exc("other_pets", "block");

  return criteria;
}
