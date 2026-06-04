/**
 * Seznam žádostí — hrubé koše, pipeline pilulka, dní čekání a kontext zvířete.
 * Skríning/skóre sdílí s Adopce tabem (krok 7) přes `scoreApplication`.
 */
import type { AdoptionStatus, ApplicationStatus } from "@/types/database";

export type AppBucket = "new" | "active" | "completed" | "rejected";

export const APP_BUCKETS: { key: AppBucket | "all"; label: string }[] = [
  { key: "all", label: "Vše" },
  { key: "new", label: "Nové" },
  { key: "active", label: "Probíhající" },
  { key: "completed", label: "Dokončené" },
  { key: "rejected", label: "Zamítnuté" },
];

export const ACTIVE_STATUSES: ApplicationStatus[] = [
  "review",
  "phone_contact",
  "in_person_meeting",
  "approved",
  "contract_signed",
];

export type AppSegment = "active" | "archive" | "all";
export const APP_SEGMENTS: { key: AppSegment; label: string }[] = [
  { key: "active", label: "Aktivní" },
  { key: "archive", label: "Archiv" },
  { key: "all", label: "Vše" },
];

export type AppSort = "newest" | "waiting" | "score";
export const APP_SORTS: { key: AppSort; label: string }[] = [
  { key: "newest", label: "Nejnovější" },
  { key: "waiting", label: "Nejdéle čeká" },
  { key: "score", label: "Skóre" },
];

export function parseBucket(raw: string | undefined): AppBucket | "all" {
  return (APP_BUCKETS.find((b) => b.key === raw)?.key ?? "all") as AppBucket | "all";
}
export function parseAppSegment(raw: string | undefined): AppSegment {
  return (APP_SEGMENTS.find((s) => s.key === raw)?.key ?? "active") as AppSegment;
}
export function parseAppSort(raw: string | undefined): AppSort {
  return (APP_SORTS.find((s) => s.key === raw)?.key ?? "newest") as AppSort;
}

/** Pipeline pilulka (jemný stav → label + tón, bez teal). */
export function pipelinePill(status: ApplicationStatus): { label: string; tone: string } {
  switch (status) {
    case "new":
      return { label: "Nová", tone: "bg-peach-200 text-terracotta-600" };
    case "review":
    case "phone_contact":
    case "in_person_meeting":
      return { label: "Skríning", tone: "bg-sunshine-200 text-sunshine-600" };
    case "approved":
      return { label: "Schválena", tone: "bg-fern-50 text-fern-700" };
    case "contract_signed":
      return { label: "Zkušební", tone: "bg-cream-warm text-ink-700" };
    case "completed":
      return { label: "Dokončeno", tone: "bg-fern-600 text-cream" };
    case "rejected":
      return { label: "Zamítnuto", tone: "bg-ink-900/8 text-ink-500" };
    default:
      return { label: status, tone: "bg-ink-900/8 text-ink-500" };
  }
}

/** Dní čekání u nevyřízených (nová / skríning). U uzavřených null. */
export function waitingDays(status: ApplicationStatus, createdAt: string, todayMs: number): number | null {
  if (status === "completed" || status === "rejected") return null;
  const created = new Date(createdAt).getTime();
  return Math.max(0, Math.floor((todayMs - created) / 86_400_000));
}

/** „Nová" = nepřečtená tečka. */
export function isUnread(status: ApplicationStatus): boolean {
  return status === "new";
}

/**
 * Kontext zvířete: zvíře už pryč / rezervováno a tahle žádost ještě běží
 * → upozornit, ať se nevytvoří dvojí příslib.
 */
export function animalContext(
  appStatus: ApplicationStatus,
  animalStatus: AdoptionStatus | null,
): string | null {
  if (appStatus === "completed" || appStatus === "rejected") return null;
  if (appStatus === "approved" || appStatus === "contract_signed") return null;
  if (!animalStatus) return null;
  if (animalStatus === "reserved") return "⚠ zvíře už rezervováno — vyřeš zbývající zájemce";
  if (["adopted", "transferred", "deceased"].includes(animalStatus)) {
    return "⚠ zvíře už není dostupné — nabídni podobné";
  }
  return null;
}
