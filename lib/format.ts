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
