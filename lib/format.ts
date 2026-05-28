import type { ApplicationStatus } from "@/types/database";

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

export const ENERGY_LABEL: Record<string, string> = {
  low: "Klidná",
  medium: "Vyvážená",
  high: "Aktivní",
};

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
