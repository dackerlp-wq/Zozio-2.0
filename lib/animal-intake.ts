/**
 * Výchozí nastavení odvozené ze způsobu příjmu zvířete.
 *
 * Každý způsob příjmu má v praxi jiný výchozí právní stav a režim dohledu —
 * např. nalezenec automaticky spadá do ochranné lhůty a karantény, zatímco
 * mládě narozené v útulku je rovnou ve vlastnictví útulku a bez karantény.
 *
 * Logika je čistá (bez DB) a sdílí ji formulář pro nové zvíře, záložka Příjem
 * i server (createAnimal). Hodnoty jsou jen NÁVRH — uživatel je může přepsat.
 */
import type {
  AnimalIntakeType,
  AnimalLegalStatus,
  AnimalSupervisionStatus,
} from "@/types/database";

export interface IntakeDefaults {
  /** Výchozí stav vlastnictví. */
  legal_status: AnimalLegalStatus;
  /** Výchozí režim veterinárního dohledu při příjmu. */
  supervision_status: AnimalSupervisionStatus;
  /** Běží ochranná lhůta (původní majitel se může přihlásit). */
  protection: boolean;
  /** Relevantní pole o nálezu (místo, datum, vyhlášení). */
  needsFoundInfo: boolean;
  /** Relevantní pole o původním majiteli (vzdání se práv). */
  needsOriginalOwner: boolean;
  /** Krátké vysvětlení, proč jsou tyto výchozí hodnoty zvolené. */
  note: string;
}

const DEFAULTS: Record<AnimalIntakeType, IntakeDefaults> = {
  found: {
    legal_status: "in_protection",
    supervision_status: "quarantine",
    protection: true,
    needsFoundInfo: true,
    needsOriginalOwner: false,
    note: "Nalezenec — běží ochranná lhůta a vstupní karanténa. Zveřejnit a adoptovat lze až po jejím uzavření a vyřešení práva.",
  },
  confiscation: {
    legal_status: "in_protection",
    supervision_status: "isolation",
    protection: true,
    needsFoundInfo: true,
    needsOriginalOwner: false,
    note: "Odebrané zvíře — vlastnictví není vyřešeno (ochranná lhůta), nasazena izolace do posouzení stavu.",
  },
  surrender: {
    legal_status: "shelter_owned",
    supervision_status: "quarantine",
    protection: false,
    needsFoundInfo: false,
    needsOriginalOwner: true,
    note: "Odevzdáno majitelem — po vzdání se práv je rovnou ve vlastnictví útulku. Vstupní karanténa stále platí.",
  },
  transfer: {
    legal_status: "shelter_owned",
    supervision_status: "quarantine",
    protection: false,
    needsFoundInfo: false,
    needsOriginalOwner: false,
    note: "Převzato z jiné instituce — ve vlastnictví útulku, vstupní karanténa pro nově příchozí zvíře.",
  },
  born: {
    legal_status: "shelter_owned",
    supervision_status: "released",
    protection: false,
    needsFoundInfo: false,
    needsOriginalOwner: false,
    note: "Narozeno v péči útulku — ve vlastnictví útulku, bez vstupní karantény.",
  },
  other: {
    legal_status: "shelter_owned",
    supervision_status: "quarantine",
    protection: false,
    needsFoundInfo: false,
    needsOriginalOwner: false,
    note: "Jiný způsob příjmu — výchozí karanténa, doplň právní stav ručně podle situace.",
  },
};

const NEUTRAL: IntakeDefaults = {
  legal_status: "shelter_owned",
  supervision_status: "released",
  protection: false,
  needsFoundInfo: false,
  needsOriginalOwner: false,
  note: "",
};

/** Vrátí výchozí nastavení pro daný způsob příjmu (návrh, lze přepsat). */
export function intakeDefaults(
  type: AnimalIntakeType | null,
): IntakeDefaults {
  return type ? DEFAULTS[type] : NEUTRAL;
}
