/**
 * Pomocné mapování úkolů — bez DB.
 *
 * Z `AnimalTaskType` odvodí „zdroj" úkolu: barevný chip + popisek + slug
 * záložky karty zvířete, kam vede „Otevřít". Filtry dashboardu úkolů jsou
 * postavené nad těmito klíči. Žádná migrace netřeba — zdroj je odvozený z typu.
 */
import type { AnimalTaskType } from "@/types/database";

export type TaskSourceKey =
  | "health"
  | "quarantine"
  | "legal"
  | "foster"
  | "adoption"
  | "manual"
  | "system";

export interface TaskSourceMeta {
  key: TaskSourceKey;
  label: string;
  /** Slug záložky karty zvířete (deep-link „Otevřít"). "" = Přehled. */
  slug: string;
  /** Tailwind třídy chipu (bez modré). */
  tone: string;
}

const META: Record<AnimalTaskType, TaskSourceMeta> = {
  vaccination: { key: "health", label: "Zdraví", slug: "zdravi", tone: "bg-fern-50 text-fern-700" },
  treatment: { key: "health", label: "Zdraví", slug: "zdravi", tone: "bg-fern-50 text-fern-700" },
  deworming: { key: "health", label: "Zdraví", slug: "zdravi", tone: "bg-fern-50 text-fern-700" },
  vet_checkup: { key: "health", label: "Zdraví", slug: "zdravi", tone: "bg-fern-50 text-fern-700" },
  grooming: { key: "health", label: "Zdraví", slug: "zdravi", tone: "bg-fern-50 text-fern-700" },
  quarantine_end: { key: "quarantine", label: "Karanténa", slug: "karantena", tone: "bg-sunshine-200 text-sunshine-600" },
  protection_deadline: { key: "legal", label: "Lhůta", slug: "prijem", tone: "bg-peach-100 text-terracotta-600" },
  foster_followup: { key: "foster", label: "Pěstoun", slug: "pestoun", tone: "bg-sage-100 text-sage-700" },
  adoption_followup: { key: "adoption", label: "Adopce", slug: "adopce", tone: "bg-meadow-50 text-meadow-700" },
  long_stay: { key: "system", label: "Systém", slug: "", tone: "bg-cream-warm text-ink-400" },
  custom: { key: "manual", label: "Ruční", slug: "", tone: "bg-cream-warm text-ink-600" },
};

export function taskSourceMeta(type: AnimalTaskType): TaskSourceMeta {
  return META[type] ?? META.custom;
}

/** Deep-link „Otevřít" na zdrojovou záložku konkrétního zvířete. */
export function taskOpenHref(type: AnimalTaskType, animalId: string | null): string {
  if (!animalId) return "/admin/tasks";
  const slug = taskSourceMeta(type).slug;
  return slug ? `/admin/animals/${animalId}/${slug}` : `/admin/animals/${animalId}`;
}

/** Filtry zdroje pro dashboard úkolů (pořadí = zleva doprava v liště). */
export const TASK_SOURCE_FILTERS: { key: TaskSourceKey | "all"; label: string; icon: string }[] = [
  { key: "all", label: "Vše", icon: "" },
  { key: "health", label: "Zdraví", icon: "💉" },
  { key: "quarantine", label: "Karanténa", icon: "🛡️" },
  { key: "legal", label: "Lhůta", icon: "⏳" },
  { key: "foster", label: "Pěstoun", icon: "🏡" },
  { key: "adoption", label: "Adopce", icon: "🤝" },
  { key: "manual", label: "Ruční", icon: "📋" },
];

/**
 * Patří úkol pod daný filtr? „manual" zahrnuje i systémové (long_stay),
 * aby měl každý úkol domov i bez vlastního filtru.
 */
export function matchesSourceFilter(type: AnimalTaskType, filter: TaskSourceKey | "all"): boolean {
  if (filter === "all") return true;
  const key = taskSourceMeta(type).key;
  if (filter === "manual") return key === "manual" || key === "system";
  return key === filter;
}

/* ── Nálož týdne ──────────────────────────────────────────────────── */

export interface WeekLoadDay {
  /** YYYY-MM-DD (lokální). */
  date: string;
  /** Den v týdnu zkráceně (Po, Út…). */
  label: string;
  /** Číslo dne v měsíci. */
  day: number;
  count: number;
  isToday: boolean;
  /** Náročný den — výrazně nad průměrem (≥4 úkoly). */
  heavy: boolean;
  /** Po termínu (jen u dnů před dneškem). */
  past: boolean;
}

const WEEKDAY_CZ = ["Ne", "Po", "Út", "St", "Čt", "Pá", "So"];

function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Spočítá „nálož týdne" — počet otevřených úkolů s termínem na každý
 * z následujících 7 dní (počínaje dneškem). Úkoly bez termínu se ignorují.
 */
export function weekLoad(
  tasks: { due_date: string | null }[],
  today: Date = new Date(),
): WeekLoadDay[] {
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todayStr = localDateStr(base);

  const counts = new Map<string, number>();
  for (const t of tasks) {
    if (!t.due_date) continue;
    const key = t.due_date.slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const out: WeekLoadDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const date = localDateStr(d);
    const count = counts.get(date) ?? 0;
    out.push({
      date,
      label: WEEKDAY_CZ[d.getDay()],
      day: d.getDate(),
      count,
      isToday: date === todayStr,
      heavy: count >= 4,
      past: date < todayStr,
    });
  }
  return out;
}
