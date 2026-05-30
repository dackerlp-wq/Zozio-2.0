/**
 * Auditní historie změn polí zvířete — čisté pomocné funkce + zapisovač.
 *
 * Diff dvou verzí záznamu (před/po) přes sledovaná pole, lidsky čitelné
 * popisky polí i hodnot a uložení rozdílů do `animal_field_history`.
 * Modul je client-safe: DB klient se předává jako parametr, nic se neimportuje
 * ze service vrstvy.
 */
import {
  ADOPTION_STATUS_LABEL,
  ANIMAL_INTAKE_TYPE_LABEL,
  ANIMAL_LEGAL_STATUS_LABEL,
  ENERGY_LABEL,
  HEALTH_STATUS_LABEL,
  SEX_LABEL,
  SIZE_LABEL,
  SPECIES_LABEL,
  VET_CARE_NEED_LABEL,
} from "@/lib/format";

/** Lidský popisek sledovaného pole (sloupec → název v UI). */
export const HISTORY_FIELD_LABEL: Record<string, string> = {
  // Profil
  name: "Jméno",
  species: "Druh",
  breed: "Plemeno",
  is_crossbreed: "Kříženec",
  breed_secondary: "Druhé plemeno",
  primary_photo_url: "Hlavní fotka",
  gallery: "Galerie",
  description: "Popis",
  age_years: "Věk (roky)",
  age_months: "Věk (měsíce)",
  sex: "Pohlaví",
  size: "Velikost",
  color: "Barva",
  weight_kg: "Váha (kg)",
  is_neutered: "Kastrace",
  is_vaccinated: "Očkování",
  is_chipped: "Čipování",
  health_status: "Zdravotní stav",
  health_notes: "Zdravotní poznámky",
  good_with_children: "Snáší děti",
  good_with_dogs: "Snáší psy",
  good_with_cats: "Snáší kočky",
  energy_level: "Energie",
  care_difficulty: "Náročnost péče",
  suitable_housing: "Vhodné bydlení",
  personality_tags: "Povahové štítky",
  story_title: "Název příběhu",
  story_text: "Příběh",
  adoption_status: "Adopční stav",
  is_urgent: "Naléhavé",
  // Příjem & právní stav
  intake_type: "Způsob příjmu",
  intake_date: "Datum příjmu",
  intake_time: "Čas příjmu",
  found_location: "Místo nálezu",
  found_date: "Datum nálezu",
  announced_at: "Datum vyhlášení",
  found_lat: "Nález — šířka",
  found_lng: "Nález — délka",
  handed_over_by: "Předal(a)",
  handed_over_phone: "Telefon předávajícího",
  handed_over_email: "E-mail předávajícího",
  intake_condition: "Stav při příjmu",
  record_number: "Evidenční číslo",
  chip_number: "Číslo čipu",
  tattoo: "Tetování",
  ear_tag: "Ušní známka",
  identification_none: "Bez identifikace",
  vet_care_need: "Potřeba veter. péče",
  intake_quarantine_days: "Karanténa (dní)",
  intake_staff: "Přijal(a)",
  intake_notes: "Poznámky k příjmu",
  municipality_ref: "Reference obce",
  registry_name: "Registr",
  legal_status: "Právní stav",
  protection_until: "Ochranná lhůta do",
  original_owner: "Původní majitel",
  surrender_waiver_at: "Vzdání se práv dne",
  surrender_waiver_url: "Dokument vzdání se práv",
};

const COMPAT_LABEL: Record<string, string> = {
  yes: "Ano",
  no: "Ne",
  unknown: "Neznámo",
};
const CARE_DIFFICULTY_LABEL: Record<string, string> = {
  easy: "Snadná",
  medium: "Střední",
  high: "Náročná",
};
const SUITABLE_HOUSING_LABEL: Record<string, string> = {
  apartment: "Byt",
  house: "Dům",
  both: "Byt i dům",
};

const ENUM_LABEL: Record<string, Record<string, string>> = {
  species: SPECIES_LABEL,
  sex: SEX_LABEL,
  size: SIZE_LABEL,
  health_status: HEALTH_STATUS_LABEL,
  adoption_status: ADOPTION_STATUS_LABEL,
  legal_status: ANIMAL_LEGAL_STATUS_LABEL,
  intake_type: ANIMAL_INTAKE_TYPE_LABEL,
  vet_care_need: VET_CARE_NEED_LABEL,
  energy_level: ENERGY_LABEL,
  good_with_children: COMPAT_LABEL,
  good_with_dogs: COMPAT_LABEL,
  good_with_cats: COMPAT_LABEL,
  care_difficulty: CARE_DIFFICULTY_LABEL,
  suitable_housing: SUITABLE_HOUSING_LABEL,
};

const BOOLEAN_FIELDS = new Set([
  "is_crossbreed",
  "is_vaccinated",
  "is_urgent",
  "identification_none",
  "auto_publish",
]);
/** Tri-stavové booleany (true/false/neznámo). */
const TRISTATE_FIELDS = new Set(["is_neutered", "is_chipped"]);
const URL_FIELDS = new Set(["primary_photo_url", "surrender_waiver_url"]);

/** Lidsky čitelná hodnota pole pro zápis do historie. */
export function formatHistoryValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";

  if (BOOLEAN_FIELDS.has(field)) return value ? "Ano" : "Ne";
  if (TRISTATE_FIELDS.has(field)) return value ? "Ano" : "Ne";
  if (URL_FIELDS.has(field)) return "nastaveno";

  if (field === "gallery" && Array.isArray(value))
    return value.length ? `${value.length} fotek` : "—";
  if (field === "personality_tags" && Array.isArray(value))
    return value.length ? value.join(", ") : "—";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";

  const enumMap = ENUM_LABEL[field];
  if (enumMap && typeof value === "string") return enumMap[value] ?? value;

  return String(value);
}

/** Normalizace hodnoty pro porovnání (sjednotí null/""/undefined a pole). */
function normalize(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (Array.isArray(value)) return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}

export interface FieldChange {
  field: string;
  old_value: string;
  new_value: string;
}

/**
 * Porovná dva záznamy (před/po) přes sledovaná pole vyskytující se v `after`
 * a vrátí seznam změn s lidsky čitelnými hodnotami.
 */
export function diffAnimalRows(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of Object.keys(after)) {
    if (!(field in HISTORY_FIELD_LABEL)) continue;
    const a = normalize(before[field]);
    const b = normalize(after[field]);
    if (a === b) continue;
    changes.push({
      field,
      old_value: formatHistoryValue(field, before[field]),
      new_value: formatHistoryValue(field, after[field]),
    });
  }
  return changes;
}

/** Minimální tvar Supabase klienta potřebný k zápisu historie. */
interface InsertableClient {
  from: (table: "animal_field_history") => {
    insert: (rows: unknown[]) => PromiseLike<unknown>;
  };
}

/**
 * Zapíše rozdíly polí do auditní historie. Tichý no-op, pokud se nic nezměnilo.
 */
export async function logAnimalFieldChanges(
  client: InsertableClient,
  params: {
    animalId: string;
    institutionId: string;
    changedBy: string | null;
    before: Record<string, unknown>;
    after: Record<string, unknown>;
  },
): Promise<void> {
  const changes = diffAnimalRows(params.before, params.after);
  if (changes.length === 0) return;
  await client.from("animal_field_history").insert(
    changes.map((c) => ({
      animal_id: params.animalId,
      institution_id: params.institutionId,
      field: c.field,
      old_value: c.old_value,
      new_value: c.new_value,
      changed_by: params.changedBy,
    })),
  );
}
