/**
 * Seznam zvířat — presety, řazení, segmenty a odvození řádku (bez DB).
 * Logika zveřejnění: „připraveno, ne na webu" = shelter_owned + splněné
 * hradlo publish (vyplněný příjem + uzavřená karanténa) + není available.
 */
import type {
  AdoptionStatus,
  AnimalIntakeType,
  AnimalLegalStatus,
  AnimalSupervisionStatus,
  Sex,
  Species,
} from "@/types/database";

export const TERMINAL_STATUSES: AdoptionStatus[] = [
  "adopted",
  "transferred",
  "deceased",
  "returned",
];

export type ListPreset =
  | "all"
  | "available"
  | "in_protection"
  | "quarantine"
  | "ready_unpublished"
  | "foster"
  | "long_stay";

export const LIST_PRESETS: { key: ListPreset; label: string }[] = [
  { key: "all", label: "Vše" },
  { key: "available", label: "K adopci" },
  { key: "in_protection", label: "V ochranné lhůtě" },
  { key: "quarantine", label: "V karanténě" },
  { key: "ready_unpublished", label: "Připraveno, ne na webu" },
  { key: "foster", label: "U pěstouna" },
  { key: "long_stay", label: "90+ dní" },
];

export type ListSegment = "active" | "archive" | "all";
export const LIST_SEGMENTS: { key: ListSegment; label: string }[] = [
  { key: "active", label: "Aktivní" },
  { key: "archive", label: "Archiv" },
  { key: "all", label: "Vše" },
];

export type ListSort = "intake_desc" | "name_asc" | "stay_desc" | "status";
export const LIST_SORTS: { key: ListSort; label: string }[] = [
  { key: "intake_desc", label: "Nejnovější příjem" },
  { key: "name_asc", label: "Jméno A–Z" },
  { key: "stay_desc", label: "Délka pobytu ↓" },
  { key: "status", label: "Stav" },
];

export function parsePreset(raw: string | undefined): ListPreset {
  return (LIST_PRESETS.find((p) => p.key === raw)?.key ?? "all") as ListPreset;
}
export function parseSegment(raw: string | undefined): ListSegment {
  return (LIST_SEGMENTS.find((s) => s.key === raw)?.key ?? "active") as ListSegment;
}
export function parseSort(raw: string | undefined): ListSort {
  return (LIST_SORTS.find((s) => s.key === raw)?.key ?? "intake_desc") as ListSort;
}

const DAY = 86_400_000;
export function daysInShelter(intakeDate: string | null, todayStr: string): number | null {
  if (!intakeDate) return null;
  const a = new Date(intakeDate + "T00:00:00").getTime();
  const b = new Date(todayStr + "T00:00:00").getTime();
  return Math.max(0, Math.round((b - a) / DAY));
}

export interface AnimalListRaw {
  id: string;
  name: string;
  species: Species;
  breed: string | null;
  sex: Sex;
  age_years: number | null;
  age_months: number | null;
  birth_date: string | null;
  primary_photo_url: string | null;
  adoption_status: AdoptionStatus;
  legal_status: AnimalLegalStatus;
  supervision_status: AnimalSupervisionStatus;
  intake_type: AnimalIntakeType | null;
  intake_date: string | null;
  protection_until: string | null;
  found_listing_published: boolean;
  is_urgent: boolean;
  kennel: { name: string } | null;
}

export type RowMicroAction = "publish" | "found_listing" | "to_shelter" | "end_supervision" | "finalize";

export interface RowBadge {
  label: string;
  tone: string;
}

export function isReadyUnpublished(a: {
  legal_status: AnimalLegalStatus;
  adoption_status: AdoptionStatus;
  supervision_status: AnimalSupervisionStatus;
  intake_type: AnimalIntakeType | null;
  intake_date: string | null;
}): boolean {
  if (a.legal_status !== "shelter_owned") return false;
  if (a.adoption_status === "available" || TERMINAL_STATUSES.includes(a.adoption_status)) return false;
  return a.supervision_status === "released" && a.intake_type !== null && !!a.intake_date;
}

/** Sekundární badge (právní/dohledové osy). */
export function secondaryBadges(a: AnimalListRaw, days: number | null): RowBadge[] {
  const out: RowBadge[] = [];
  if (a.legal_status === "in_protection") {
    out.push({ label: "v lhůtě", tone: "bg-sunshine-200 text-sunshine-600" });
    if (a.found_listing_published) out.push({ label: "katalog nalezenců", tone: "bg-peach-100 text-terracotta-600" });
  }
  if (a.supervision_status === "quarantine" || a.supervision_status === "isolation") {
    out.push({ label: "karanténa", tone: "bg-peach-100 text-terracotta-600" });
  }
  if (days != null && days >= 90 && !TERMINAL_STATUSES.includes(a.adoption_status)) {
    out.push({ label: "90+ dní", tone: "bg-peach-200 text-terracotta-600" });
  }
  return out;
}

/** Kontextová mikro-akce řádku (respekt logice zveřejnění). */
export function rowMicroAction(a: AnimalListRaw): { action: RowMicroAction; label: string } | null {
  if (TERMINAL_STATUSES.includes(a.adoption_status)) return null;
  if (isReadyUnpublished(a)) return { action: "publish", label: "Zveřejnit" };
  if (a.legal_status === "in_protection") {
    return a.intake_type === "found" && !a.found_listing_published
      ? { action: "found_listing", label: "Nalezenec ↗" }
      : { action: "to_shelter", label: "Převést na útulek" };
  }
  if (a.supervision_status === "quarantine" || a.supervision_status === "isolation") {
    return { action: "end_supervision", label: "Ukončit dohled" };
  }
  if (a.adoption_status === "reserved") return { action: "finalize", label: "Dokončit adopci" };
  return null;
}

/** Tečka pozornosti: naléhavé / vypršelá lhůta. */
export function needsAttention(a: AnimalListRaw, todayStr: string): boolean {
  if (a.is_urgent) return true;
  if (
    a.legal_status === "in_protection" &&
    a.protection_until &&
    a.protection_until < todayStr
  )
    return true;
  return false;
}
