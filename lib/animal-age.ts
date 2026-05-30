/**
 * Živý výpočet věku zvířete.
 *
 * Věk se nepamatuje jako statické číslo, ale dopočítává se z `birth_date`:
 *  - přesné datum narození (birth_date_is_estimate=false), nebo
 *  - odhad zakotvený k datu příjmu (birth_date_is_estimate=true), dopočtený
 *    z věku zadaného při příjmu.
 *
 * Když birth_date chybí, padáme zpět na ručně zadané age_years/age_months.
 * Modul je client-safe (čisté funkce, žádné importy ze service vrstvy).
 */
import { ageLabel } from "@/lib/format";

/** Bezpečně rozparsuje YYYY-MM-DD na UTC Date (nebo null). */
function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Aktuální věk (roky + zbývající měsíce) z data narození k datu `now`. */
export function currentAgeParts(
  birthDate: string | null | undefined,
  now: Date = new Date(),
): { years: number; months: number } | null {
  const b = parseDate(birthDate);
  if (!b) return null;

  let months =
    (now.getUTCFullYear() - b.getUTCFullYear()) * 12 +
    (now.getUTCMonth() - b.getUTCMonth());
  // Den v měsíci ještě nedosažen → o měsíc méně.
  if (now.getUTCDate() < b.getUTCDate()) months -= 1;
  if (months < 0) months = 0;

  return { years: Math.floor(months / 12), months: months % 12 };
}

/** Minimální tvar zvířete pro výpočet/zobrazení věku. */
export interface AgeSource {
  birth_date?: string | null;
  age_years?: number | null;
  age_months?: number | null;
}

/**
 * Lidský popisek aktuálního věku. Preferuje živý výpočet z birth_date,
 * jinak padá zpět na ruční age_years/age_months.
 */
export function animalAgeLabel(a: AgeSource, now: Date = new Date()): string {
  const parts = currentAgeParts(a.birth_date, now);
  if (parts) return ageLabel(parts.years, parts.months);
  return ageLabel(a.age_years, a.age_months);
}

/** Odečte od data (YYYY-MM-DD) roky + měsíce a vrátí YYYY-MM-DD. */
export function shiftBack(iso: string, years: number, months: number): string {
  const d = new Date(iso.slice(0, 10) + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() - (years * 12 + months));
  return d.toISOString().slice(0, 10);
}

/**
 * Odvodí birth_date a příznak odhadu z formulářových vstupů.
 *  - přesné datum narození → bere se přednostně, není odhad,
 *  - jinak věk + kotva (datum příjmu / dnešek) → odhadovaný birth_date,
 *  - nic → null.
 */
export function resolveBirthDate(input: {
  dob: string | null;
  ageYears: number | null;
  ageMonths: number | null;
  anchorDate: string;
}): { birth_date: string | null; birth_date_is_estimate: boolean } {
  const dob = input.dob?.trim();
  if (dob) return { birth_date: dob, birth_date_is_estimate: false };

  const years = input.ageYears ?? 0;
  const months = input.ageMonths ?? 0;
  if (years > 0 || months > 0) {
    return {
      birth_date: shiftBack(input.anchorDate, years, months),
      birth_date_is_estimate: true,
    };
  }
  return { birth_date: null, birth_date_is_estimate: true };
}
