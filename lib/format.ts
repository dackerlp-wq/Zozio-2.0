import type {
  AdoptionStage,
  AdoptionStatus,
  AnimalCostCategory,
  AnimalDocumentCategory,
  AnimalExitType,
  AnimalIncidentType,
  AnimalIntakeType,
  AnimalVetCareNeed,
  AnimalLegalStatus,
  AnimalSupervisionStatus,
  AnimalTaskPriority,
  AnimalTaskStatus,
  AnimalTaskType,
  ApplicationStatus,
  TaskScheduleFreq,
  CareLogType,
  HealthStatus,
  KennelKind,
  KennelStatus,
  TreatmentType,
} from "@/types/database";

export function ageLabel(years?: number | null, months?: number | null): string {
  if (years && years > 0) {
    if (years === 1) return "1 rok";
    if (years < 5) return `${years} roky`;
    return `${years} let`;
  }
  if (months && months > 0) {
    if (months === 1) return "1 měsíc";
    if (months < 5) return `${months} měsíce`;
    return `${months} měsíců`;
  }
  return "věk neuveden";
}

export const SPECIES_LABEL: Record<string, string> = {
  dog: "Pes",
  cat: "Kočka",
  rabbit: "Králík",
  other: "Jiné",
};

// --- Kotce ----------------------------------------------------------------

export const KENNEL_KIND_LABEL: Record<KennelKind, string> = {
  standard: "Běžný",
  quarantine: "Karanténa",
  isolation: "Izolace",
  intake: "Příjem",
  outdoor: "Výběh",
  cattery: "Kočičí",
  maternity: "Porodní",
};

export const KENNEL_KIND_ICON: Record<KennelKind, string> = {
  standard: "🏠",
  quarantine: "🛡️",
  isolation: "⚠️",
  intake: "📥",
  outdoor: "🌳",
  cattery: "🐈",
  maternity: "🍼",
};

/** Typy, které se chovají jako karanténa (oddělený režim). */
export const KENNEL_QUARANTINE_KINDS: KennelKind[] = ["quarantine", "isolation"];

export const KENNEL_STATUS_LABEL: Record<KennelStatus, string> = {
  active: "V provozu",
  cleaning: "Úklid",
  out_of_service: "Mimo provoz",
  reserved: "Rezervováno",
};

export const KENNEL_STATUS_BADGE: Record<KennelStatus, string> = {
  active: "bg-sage-100 text-sage-700",
  cleaning: "bg-sunshine-200 text-sunshine-600",
  out_of_service: "bg-ink-900/10 text-ink-500",
  reserved: "bg-peach-200 text-terracotta-600",
};

export const SIZE_LABEL: Record<string, string> = {
  small: "Malé",
  medium: "Střední",
  large: "Velké",
  xlarge: "Obří",
};

export const SEX_LABEL: Record<string, string> = {
  male: "♂ Samec",
  female: "♀ Samice",
  unknown: "Neznámé",
};

/**
 * Zdravotní stav = pohledový (vizuální) stav zvířete při příjmu.
 * Pořadí odpovídá výběru ve formuláři: zdravé / nemocné / léčené / handicap /
 * neznámo.
 */
export const HEALTH_STATUS_LABEL: Record<HealthStatus, string> = {
  healthy: "Zdravé",
  sick: "Nemocné",
  treated: "Léčené",
  special_needs: "Handicap / speciální péče",
  unknown: "Neznámo",
};

export const ENERGY_LABEL: Record<string, string> = {
  low: "Klidná",
  medium: "Vyvážená",
  high: "Aktivní",
};

// ---- Adopční stav / životní cyklus zvířete --------------------------------

export const ADOPTION_STATUS_LABEL: Record<AdoptionStatus, string> = {
  intake: "Příjem",
  available: "K adopci",
  reserved: "Rezervováno",
  on_hold: "Pozastaveno",
  foster: "Pěstoun",
  adopted: "Adoptováno",
  returned: "Vráceno",
  transferred: "Převedeno",
  deceased: "Úhyn",
  unpublished: "Nezveřejněno",
};

export const ADOPTION_STATUS_PILL: Record<AdoptionStatus, string> = {
  intake: "bg-meadow-100 text-meadow-700",
  available: "bg-sage-100 text-sage-700",
  reserved: "bg-sunshine-200 text-sunshine-600",
  on_hold: "bg-peach-200 text-terracotta-600",
  foster: "bg-sage-100 text-sage-700",
  adopted: "bg-sage-500 text-cream",
  returned: "bg-peach-200 text-terracotta-600",
  transferred: "bg-ink-900/8 text-ink-600",
  deceased: "bg-ink-900/12 text-ink-700",
  unpublished: "bg-ink-900/8 text-ink-600",
};

/** Krátká nápověda u ručně volitelných stavů (v přepínači stavu). */
export const ADOPTION_STATUS_HELP: Partial<Record<AdoptionStatus, string>> = {
  intake: "Zvíře je v evidenci, ještě nepřipravené na web.",
  available: "Zveřejněno v adopčním katalogu, hledá domov.",
  on_hold: "Dočasně pozastaveno (nemoc, čekání) — z webu zmizí, vrátíš zpět.",
  transferred: "Trvale předáno jinému subjektu — výstupní stav.",
  unpublished: "Staženo z webu — drženo mimo veřejnou nabídku bez výstupu.",
};

/** Stavy zobrazené veřejně (musí ladit s RLS animals_public_read). */
export const PUBLIC_ADOPTION_STATUSES: AdoptionStatus[] = [
  "available",
  "reserved",
];

/** Výstupní (terminální) stavy — při přechodu vyžadujeme poznámku. */
export const ADOPTION_OUTCOME_STATUSES: AdoptionStatus[] = [
  "adopted",
  "transferred",
  "deceased",
];

/** Pořadí stavů v UI přepínači životního cyklu. */
export const ADOPTION_STATUS_FLOW: AdoptionStatus[] = [
  "intake",
  "available",
  "reserved",
  "on_hold",
  "foster",
  "adopted",
  "returned",
  "transferred",
  "deceased",
  "unpublished",
];

export function isAdoptionOutcome(status: AdoptionStatus): boolean {
  return ADOPTION_OUTCOME_STATUSES.includes(status);
}

/**
 * Stavy, které smí uživatel nastavit ručně (přepínač stavu).
 * Ostatní (`reserved`, `foster`, `adopted`, `returned`, `deceased`) jsou
 * „odvozené" — nastavují je výhradně strukturované toky:
 *   reserved/adopted → Adopce, foster → Pěstoun, returned/deceased → Výstupy.
 */
export const MANUAL_ADOPTION_STATUSES: AdoptionStatus[] = [
  "intake",
  "available",
  "on_hold",
  "transferred",
  "unpublished",
];

export const DERIVED_ADOPTION_STATUSES: AdoptionStatus[] = [
  "reserved",
  "foster",
  "adopted",
  "returned",
  "deceased",
];

/** Tok/záložka, která daný odvozený stav řídí (pro nápovědu v UI). */
export const DERIVED_STATUS_SOURCE: Partial<Record<AdoptionStatus, string>> = {
  reserved: "Adopce",
  adopted: "Adopce",
  foster: "Pěstoun",
  returned: "Výstupy (záložka Adopce)",
  deceased: "Výstupy (záložka Adopce)",
};

export function isManualAdoptionStatus(status: AdoptionStatus): boolean {
  return MANUAL_ADOPTION_STATUSES.includes(status);
}

/**
 * Terminální (výstupní) stavy — zvíře opustilo útulek nebo zemřelo.
 * V těchto stavech jsou strukturované akce zamčené a záložky jen ke čtení.
 */
export function isTerminalAdoptionStatus(status: AdoptionStatus): boolean {
  return (
    status === "adopted" || status === "transferred" || status === "deceased"
  );
}

// ---- Adoption applications ------------------------------------------------

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  new: "Nová",
  review: "V posouzení",
  phone_contact: "Telefonický kontakt",
  in_person_meeting: "Osobní schůzka",
  approved: "Schváleno",
  contract_signed: "Smlouva podepsána",
  completed: "Dokončeno",
  rejected: "Zamítnuto",
};

export const APPLICATION_STATUS_PILL: Record<ApplicationStatus, string> = {
  new: "bg-peach-200 text-terracotta-600",
  review: "bg-sunshine-200 text-sunshine-600",
  phone_contact: "bg-sage-100 text-sage-700",
  in_person_meeting: "bg-sage-100 text-sage-700",
  approved: "bg-meadow-100 text-meadow-700",
  contract_signed: "bg-meadow-100 text-meadow-700",
  completed: "bg-sage-500 text-cream",
  rejected: "bg-ink-900/8 text-ink-500",
};

/** Posloupnost kroků workflow (bez zamítnutí, které je terminální vedlejší větev). */
export const APPLICATION_STATUS_FLOW: ApplicationStatus[] = [
  "new",
  "review",
  "phone_contact",
  "in_person_meeting",
  "approved",
  "contract_signed",
  "completed",
];

export const HOUSING_LABEL: Record<string, string> = {
  apartment: "Byt",
  house: "Dům",
  other: "Jiné",
};

export const APPLICANT_EXPERIENCE_LABEL: Record<string, string> = {
  none: "Žádné zkušenosti",
  some: "Nějaké zkušenosti",
  experienced: "Bohaté zkušenosti",
};

// ---- Správa zvířat — léčba ------------------------------------------------

export const TREATMENT_TYPE_LABEL: Record<TreatmentType, string> = {
  medication: "Lék",
  deworming: "Odčervení",
  antiparasitic: "Antiparazitika",
  other: "Jiné",
};

// ---- Správa zvířat — deník péče -------------------------------------------

export const CARE_LOG_TYPE_LABEL: Record<CareLogType, string> = {
  feeding: "Krmení",
  walk: "Venčení",
  play: "Hra",
  grooming: "Péče o srst",
  behavior: "Chování",
  training: "Trénink",
  cleaning: "Úklid",
  note: "Poznámka",
  photo: "Fotka",
  medical: "Zdravotní",
};

export const CARE_LOG_TYPE_ICON: Record<CareLogType, string> = {
  feeding: "🍖",
  walk: "🦮",
  play: "🎾",
  grooming: "✂️",
  behavior: "🐾",
  training: "🎓",
  cleaning: "🧽",
  note: "📝",
  photo: "📷",
  medical: "🩺",
};

// ---- Správa zvířat — úkoly ------------------------------------------------

export const ANIMAL_TASK_TYPE_LABEL: Record<AnimalTaskType, string> = {
  vaccination: "Očkování",
  treatment: "Léčba",
  deworming: "Odčervení",
  vet_checkup: "Veterinární prohlídka",
  grooming: "Péče o srst",
  long_stay: "Dlouhý pobyt",
  adoption_followup: "Kontrola po adopci",
  protection_deadline: "Konec ochranné lhůty",
  quarantine_end: "Konec karantény",
  foster_followup: "Kontrola dočasné péče",
  custom: "Vlastní",
};

export const ANIMAL_TASK_STATUS_LABEL: Record<AnimalTaskStatus, string> = {
  open: "Otevřený",
  done: "Hotovo",
  dismissed: "Zrušeno",
};

export const ANIMAL_TASK_STATUS_PILL: Record<AnimalTaskStatus, string> = {
  open: "bg-sunshine-200 text-sunshine-600",
  done: "bg-sage-100 text-sage-700",
  dismissed: "bg-ink-900/8 text-ink-500",
};

export const ANIMAL_TASK_PRIORITY_LABEL: Record<AnimalTaskPriority, string> = {
  low: "Nízká",
  normal: "Normální",
  high: "Vysoká",
};

export const ANIMAL_TASK_PRIORITY_PILL: Record<AnimalTaskPriority, string> = {
  low: "bg-ink-900/8 text-ink-500",
  normal: "bg-sage-100 text-sage-700",
  high: "bg-peach-200 text-terracotta-600",
};

/** Pro řazení: vysoká priorita nahoru. */
export const ANIMAL_TASK_PRIORITY_RANK: Record<AnimalTaskPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

export const TASK_SCHEDULE_FREQ_LABEL: Record<TaskScheduleFreq, string> = {
  daily: "Denně",
  weekly: "Týdně",
  monthly: "Měsíčně",
  yearly: "Ročně",
};

/** Jednotka pro „každých N …" (množné číslo dle intervalu se řeší v UI). */
export const TASK_SCHEDULE_FREQ_UNIT: Record<TaskScheduleFreq, string> = {
  daily: "den",
  weekly: "týden",
  monthly: "měsíc",
  yearly: "rok",
};

/**
 * Lidský popis opakování, např. „Týdně", „Každé 2 týdny", „Každé 3 měsíce".
 */
export function taskScheduleSummary(
  freq: TaskScheduleFreq,
  interval: number,
): string {
  if (interval <= 1) return TASK_SCHEDULE_FREQ_LABEL[freq];
  const plural: Record<TaskScheduleFreq, string> = {
    daily: interval < 5 ? "dny" : "dní",
    weekly: interval < 5 ? "týdny" : "týdnů",
    monthly: interval < 5 ? "měsíce" : "měsíců",
    yearly: interval < 5 ? "roky" : "let",
  };
  return `Každé ${interval} ${plural[freq]}`;
}

// ---- Příjem & právní stav (migrace 0008) --------------------------------
export const ANIMAL_LEGAL_STATUS_LABEL: Record<AnimalLegalStatus, string> = {
  in_protection: "V ochranné lhůtě",
  shelter_owned: "Ve vlastnictví útulku",
  owner_claimed: "Přihlásil se majitel",
  transferred_out: "Vlastnictví převedeno",
};

export const ANIMAL_LEGAL_STATUS_PILL: Record<AnimalLegalStatus, string> = {
  in_protection: "bg-sunshine-200 text-sunshine-600",
  shelter_owned: "bg-sage-100 text-sage-700",
  owner_claimed: "bg-peach-200 text-terracotta-600",
  transferred_out: "bg-ink-900/8 text-ink-500",
};

export const ANIMAL_LEGAL_STATUS_HELP: Record<AnimalLegalStatus, string> = {
  in_protection:
    "Běží ochranná lhůta — původní majitel se může přihlásit. Zvíře nelze trvale adoptovat.",
  shelter_owned: "Útulek může se zvířetem volně nakládat (adopce, transfer).",
  owner_claimed: "Přihlásil se původní majitel, řeší se návrat zvířete.",
  transferred_out: "Vlastnictví bylo převedeno pryč (adopce / návrat / transfer).",
};

export const ANIMAL_INTAKE_TYPE_LABEL: Record<AnimalIntakeType, string> = {
  found: "Nález",
  surrender: "Odevzdal majitel",
  transfer: "Převzato z jiného útulku",
  confiscation: "Odebráno / zabaveno",
  born: "Narozeno v útulku",
  other: "Jiné",
};

// ---- Potřeba veterinární péče při příjmu (migrace 0013) -----------------
export const VET_CARE_NEED_LABEL: Record<AnimalVetCareNeed, string> = {
  none: "Není potřeba",
  required: "Nutná (ihned)",
  scheduled: "Plánovaná",
  deferred: "Odložená",
};

export const VET_CARE_NEED_PILL: Record<AnimalVetCareNeed, string> = {
  none: "bg-sage-100 text-sage-700",
  required: "bg-peach-200 text-terracotta-600",
  scheduled: "bg-sunshine-200 text-sunshine-600",
  deferred: "bg-ink-900/8 text-ink-700",
};

// ---- Karanténa & veterinární dohled (migrace 0009) ----------------------
export const SUPERVISION_STATUS_LABEL: Record<AnimalSupervisionStatus, string> =
  {
    released: "V běžné části",
    quarantine: "Karanténa",
    isolation: "Izolace",
    monitored: "Zdravotní dohled",
  };

export const SUPERVISION_STATUS_PILL: Record<AnimalSupervisionStatus, string> = {
  released: "bg-sage-100 text-sage-700",
  quarantine: "bg-sunshine-200 text-sunshine-600",
  isolation: "bg-peach-200 text-terracotta-600",
  monitored: "bg-ink-900/8 text-ink-700",
};

export const SUPERVISION_STATUS_HELP: Record<AnimalSupervisionStatus, string> = {
  released: "Zvíře je v běžné části útulku bez zvláštního veterinárního dohledu.",
  quarantine:
    "Nově přijaté nebo s podezřením na nákazu — drženo odděleně po dobu karantény.",
  isolation:
    "Potvrzená nákaza nebo agresivita — striktně odděleno od ostatních zvířat.",
  monitored:
    "Pod zvýšeným zdravotním dohledem, ale bez nutnosti izolace.",
};

/** Režimy, které se zakládají jako epizoda dohledu (mimo „v běžné části"). */
export const SUPERVISION_KINDS: AnimalSupervisionStatus[] = [
  "quarantine",
  "isolation",
  "monitored",
];

// ---- Adopce & výstupy (fáze 10) -------------------------------------------

export const ADOPTION_STAGE_LABEL: Record<AdoptionStage, string> = {
  trial: "Zkušební doba",
  finalized: "Trvalá adopce",
  cancelled: "Zrušeno",
};

export const ADOPTION_STAGE_PILL: Record<AdoptionStage, string> = {
  trial: "bg-sunshine-200 text-sunshine-600",
  finalized: "bg-sage-500 text-cream",
  cancelled: "bg-ink-900/8 text-ink-600",
};

export const ADOPTION_STAGE_HELP: Record<AdoptionStage, string> = {
  trial:
    "Zvíře je předáno adoptantovi na zkušební dobu. Po jejím konci se adopce buď uzavře jako trvalá, nebo se zvíře vrátí.",
  finalized:
    "Trvalá adopce je uzavřena — zvíře natrvalo přešlo k novému majiteli.",
  cancelled: "Adopce byla zrušena (zvíře se vrátilo do útulku).",
};

export const ANIMAL_EXIT_TYPE_LABEL: Record<AnimalExitType, string> = {
  return: "Vrácení",
  death: "Úhyn",
  euthanasia: "Utracení",
};

export const ANIMAL_EXIT_TYPE_PILL: Record<AnimalExitType, string> = {
  return: "bg-peach-200 text-terracotta-600",
  death: "bg-ink-900/12 text-ink-700",
  euthanasia: "bg-ink-900/12 text-ink-700",
};

// ---- Náklady & incidenty (fáze 11) ----------------------------------------

export const ANIMAL_COST_CATEGORY_LABEL: Record<AnimalCostCategory, string> = {
  vet: "Veterina",
  food: "Krmivo",
  medication: "Léky",
  castration: "Kastrace",
  vaccination: "Očkování",
  transport: "Doprava",
  other: "Ostatní",
};

export const ANIMAL_COST_CATEGORIES: AnimalCostCategory[] = [
  "vet",
  "food",
  "medication",
  "castration",
  "vaccination",
  "transport",
  "other",
];

export const ANIMAL_INCIDENT_TYPE_LABEL: Record<AnimalIncidentType, string> = {
  escape: "Únik / útěk",
  injury: "Zranění",
  bite: "Pokousání",
  conflict: "Konflikt",
  other: "Jiné",
};

export const ANIMAL_INCIDENT_TYPE_PILL: Record<AnimalIncidentType, string> = {
  escape: "bg-sunshine-200 text-sunshine-600",
  injury: "bg-peach-200 text-terracotta-600",
  bite: "bg-peach-200 text-terracotta-600",
  conflict: "bg-peach-200 text-terracotta-600",
  other: "bg-ink-900/8 text-ink-600",
};

export const ANIMAL_INCIDENT_TYPES: AnimalIncidentType[] = [
  "escape",
  "injury",
  "bite",
  "conflict",
  "other",
];

// ---- Dokumenty zvířete ----------------------------------------------------

export const ANIMAL_DOCUMENT_CATEGORY_LABEL: Record<
  AnimalDocumentCategory,
  string
> = {
  medical: "Lékařská zpráva",
  vaccination: "Očkovací průkaz",
  lab: "Laboratorní výsledky",
  contract: "Smlouva",
  intake: "Příjmový doklad",
  registration: "Čipování / registrace",
  other: "Ostatní",
};

export const ANIMAL_DOCUMENT_CATEGORY_ICON: Record<
  AnimalDocumentCategory,
  string
> = {
  medical: "🩺",
  vaccination: "💉",
  lab: "🧪",
  contract: "📝",
  intake: "📥",
  registration: "🏷️",
  other: "📄",
};

export const ANIMAL_DOCUMENT_CATEGORY_PILL: Record<
  AnimalDocumentCategory,
  string
> = {
  medical: "bg-peach-200 text-terracotta-600",
  vaccination: "bg-meadow-100 text-meadow-700",
  lab: "bg-sage-100 text-sage-700",
  contract: "bg-sunshine-200 text-sunshine-600",
  intake: "bg-ink-900/8 text-ink-600",
  registration: "bg-sage-100 text-sage-700",
  other: "bg-ink-900/8 text-ink-600",
};

export const ANIMAL_DOCUMENT_CATEGORIES: AnimalDocumentCategory[] = [
  "medical",
  "vaccination",
  "lab",
  "contract",
  "intake",
  "registration",
  "other",
];
