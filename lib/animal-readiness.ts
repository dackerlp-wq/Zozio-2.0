/**
 * Připravenost zvířete k jednotlivým krokům životního cyklu.
 *
 * Systém nesmí dovolit nesmyslný/protizákonný krok — např. pustit zvíře do
 * adopce bez uzavřené karantény, bez vyplněného příjmu nebo bez identifikace.
 * Tato logika je „čistá" (bez DB) a používá ji jak server (hradla v akcích),
 * tak UI (checklist úplnosti na kartě zvířete).
 *
 * Hradla (gates):
 *   - publish        → zveřejnění na web / stav „K adopci"
 *   - adopt_start    → zahájení adopce (zkušební doba / rezervace)
 *   - adopt_finalize → uzavření trvalé adopce
 */
import type {
  AnimalIntakeType,
  AnimalLegalStatus,
  AnimalSupervisionStatus,
} from "@/types/database";

export type ReadinessGate = "publish" | "adopt_start" | "adopt_finalize";

export interface ReadinessItem {
  id: string;
  label: string;
  hint: string;
  ok: boolean;
  severity: "hard" | "soft";
  /** Která hradla tento bod blokuje (jen u severity = hard má zákazový efekt). */
  gates: ReadinessGate[];
  /**
   * Segment záložky zvířete, kde se bod vyřeší (pro tlačítko „Vyřešit").
   * `null` = řeší se přímo na přehledu (např. zveřejnění přes změnu stavu).
   */
  resolve: string | null;
}

export interface ReadinessInput {
  intake_type: AnimalIntakeType | null;
  intake_date: string | null;
  found_date: string | null;
  supervision_status: AnimalSupervisionStatus;
  legal_status: AnimalLegalStatus;
  chip_number: string | null;
  tattoo: string | null;
  ear_tag: string | null;
  identification_none: boolean;
  primary_photo_url: string | null;
  is_vaccinated: boolean;
  published_at: string | null;
  /** Běží aktivní léčba? (volitelné — když není, varování se nezobrazí) */
  has_active_treatment?: boolean;
}

function notEmpty(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

/** Vyhodnotí všechny kontrolní body pro dané zvíře. */
export function evaluateReadiness(a: ReadinessInput): ReadinessItem[] {
  const isFound = a.intake_type === "found" || a.intake_type === "confiscation";
  const hasIdentification =
    notEmpty(a.chip_number) ||
    notEmpty(a.tattoo) ||
    notEmpty(a.ear_tag) ||
    a.identification_none;

  const items: ReadinessItem[] = [
    {
      id: "intake_complete",
      label: "Vyplněný příjem",
      hint: "Doplň způsob a datum příjmu na záložce Příjem & právo.",
      ok: a.intake_type !== null && notEmpty(a.intake_date),
      severity: "hard",
      gates: ["publish", "adopt_start", "adopt_finalize"],
      resolve: "prijem",
    },
    {
      id: "quarantine_closed",
      label: "Uzavřená karanténa",
      hint: "Zvíře musí být propuštěno z karantény/izolace (záložka Karanténa).",
      ok: a.supervision_status === "released",
      severity: "hard",
      gates: ["publish", "adopt_start", "adopt_finalize"],
      resolve: "karantena",
    },
    {
      id: "identification",
      label: "Ověřená identifikace",
      hint: "Zaznamenej číslo čipu, tetování nebo známku — případně potvrď, že zvíře identifikaci nemá.",
      ok: hasIdentification,
      severity: "hard",
      gates: ["adopt_start", "adopt_finalize"],
      resolve: "prijem",
    },
    {
      id: "legal_resolved",
      label: "Vyřešený právní stav",
      hint: "Trvalou adopci nelze uzavřít během ochranné lhůty — převeď zvíře do vlastnictví útulku.",
      ok: a.legal_status !== "in_protection",
      severity: "hard",
      gates: ["adopt_finalize"],
      resolve: "prijem",
    },
    {
      id: "has_photo",
      label: "Hlavní fotka",
      hint: "Bez fotky se zvíře na webu špatně inzeruje.",
      ok: notEmpty(a.primary_photo_url),
      severity: "soft",
      gates: ["publish"],
      resolve: "profil",
    },
    {
      id: "vaccinated",
      label: "Záznam o očkování",
      hint: "Doplň očkování / zdravotní kartu.",
      ok: a.is_vaccinated,
      severity: "soft",
      gates: [],
      resolve: "zdravi",
    },
    {
      id: "treatment_open",
      label: "Neukončená léčba",
      hint: "Zvíře má rozběhnutou léčbu — před adopcí ji dokonči nebo předej info.",
      ok: !a.has_active_treatment,
      severity: "soft",
      gates: [],
      resolve: "zdravi",
    },
    {
      id: "published",
      label: "Zveřejněno na webu",
      hint: "Zvíře zatím není veřejně inzerováno — zveřejníš ho změnou stavu na K adopci.",
      ok: notEmpty(a.published_at),
      severity: "soft",
      gates: [],
      resolve: null,
    },
  ];

  if (isFound) {
    items.push({
      id: "found_date",
      label: "Datum nálezu",
      hint: "U nalezenců doplň datum nálezu (běží od něj ochranná lhůta).",
      ok: notEmpty(a.found_date),
      severity: "soft",
      gates: [],
      resolve: "prijem",
    });
  }

  return items;
}

/** Tvrdé (zákazové) body, které brání danému hradlu. */
export function blockers(
  items: ReadinessItem[],
  gate: ReadinessGate,
): ReadinessItem[] {
  return items.filter(
    (i) => i.severity === "hard" && i.gates.includes(gate) && !i.ok,
  );
}

/** Měkká upozornění (nezakáží krok). */
export function warnings(items: ReadinessItem[]): ReadinessItem[] {
  return items.filter((i) => i.severity === "soft" && !i.ok);
}

/** Souhrnná věta pro chybové hlášky v server akcích. */
export function blockerMessage(items: ReadinessItem[]): string {
  return items.map((i) => i.label).join(", ");
}

/**
 * Shrnutí připravenosti ke zveřejnění (stav „K adopci").
 * `ready` = projdou všechny tvrdé body hradla `publish`.
 * `pending` = co ještě chybí (tvrdé blokační body).
 */
export function publishReadiness(a: ReadinessInput): {
  ready: boolean;
  pending: ReadinessItem[];
} {
  const items = evaluateReadiness(a);
  const pending = blockers(items, "publish");
  return { ready: pending.length === 0, pending };
}

/**
 * Blokace adopčního formuláře. Po dobu ochranné lhůty se zvíře sice může
 * zobrazit v katalogu, ale podat žádost o adopci nelze, dokud lhůta neskončí
 * (původní majitel se ještě může přihlásit).
 */
export function adoptionFormBlock(a: {
  legal_status: AnimalLegalStatus;
  protection_until: string | null;
}): { blocked: boolean; until: string | null; reason: string } | null {
  if (a.legal_status !== "in_protection") return null;
  return {
    blocked: true,
    until: a.protection_until,
    reason: a.protection_until
      ? `Probíhá ochranná lhůta do ${a.protection_until} — žádost o adopci bude možné podat až po jejím skončení.`
      : "Probíhá ochranná lhůta — žádost o adopci bude možné podat až po jejím skončení.",
  };
}

/** Pole, která potřebujeme načíst z DB pro vyhodnocení. */
export const READINESS_SELECT =
  "intake_type, intake_date, found_date, supervision_status, legal_status, chip_number, tattoo, ear_tag, identification_none, primary_photo_url, is_vaccinated, published_at";
