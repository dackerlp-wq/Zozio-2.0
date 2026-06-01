/**
 * Čisté pomocné funkce karanténní záložky — bez DB.
 * Den/odpočet epizody, teplotní trend, vyhodnocení flagu pozorování
 * a podmínky protokolu ukončení.
 */
import type { AnimalSupervisionStatus } from "@/types/database";

export const FEVER_THRESHOLD = 39.0; // °C
const DAY_MS = 86_400_000;

/** Rychlé tagy pozorování (good = pozitivní, jinak negativní → flag „watch"). */
export const OBSERVATION_TAGS: { key: string; label: string; good: boolean }[] = [
  { key: "appetite_ok", label: "Chuť", good: true },
  { key: "stool_ok", label: "Stolice", good: true },
  { key: "lively", label: "Čilá", good: true },
  { key: "apathetic", label: "Apatická", good: false },
  { key: "cough", label: "Kašel", good: false },
  { key: "vomiting", label: "Zvracení", good: false },
  { key: "diarrhea", label: "Průjem", good: false },
];

const BAD_TAGS = new Set(OBSERVATION_TAGS.filter((t) => !t.good).map((t) => t.key));

export function tagLabel(key: string): string {
  return OBSERVATION_TAGS.find((t) => t.key === key)?.label ?? key;
}

/** Pořadové číslo dne epizody (1. den = den začátku). */
export function episodeDay(
  startedOn: string,
  now: Date = new Date(),
): number {
  const start = new Date(startedOn + "T00:00:00").getTime();
  const t = new Date(now.toISOString().slice(0, 10) + "T00:00:00").getTime();
  return Math.max(1, Math.floor((t - start) / DAY_MS) + 1);
}

/** Dní do doporučeného konce (kladné = zbývá, záporné = po termínu). */
export function daysLeft(
  plannedUntil: string | null,
  now: Date = new Date(),
): number | null {
  if (!plannedUntil) return null;
  const end = new Date(plannedUntil + "T00:00:00").getTime();
  const t = new Date(now.toISOString().slice(0, 10) + "T00:00:00").getTime();
  return Math.round((end - t) / DAY_MS);
}

/** Doporučená délka epizody ve dnech (z plánovaného konce). */
export function recommendedDays(
  startedOn: string,
  plannedUntil: string | null,
): number | null {
  if (!plannedUntil) return null;
  const start = new Date(startedOn + "T00:00:00").getTime();
  const end = new Date(plannedUntil + "T00:00:00").getTime();
  return Math.round((end - start) / DAY_MS);
}

/** Flag pozorování: negativní tag nebo horečka → „watch". */
export function evalObservationFlag(
  tags: string[] | null,
  temperature: number | null,
): "ok" | "watch" {
  if (temperature != null && temperature >= FEVER_THRESHOLD) return "watch";
  if (tags?.some((t) => BAD_TAGS.has(t))) return "watch";
  return "ok";
}

export interface TempTrend {
  points: number[];
  last: number;
  elevated: boolean;
}

/** Teplotní trend z pozorování (řazená nejstarší→nejnovější na vstupu nebo ne). */
export function tempTrend(
  observations: { temperature: number | null; observed_at: string }[],
): TempTrend | null {
  const withTemp = observations
    .filter((o) => o.temperature != null)
    .sort((a, b) => a.observed_at.localeCompare(b.observed_at)) as {
    temperature: number;
    observed_at: string;
  }[];
  if (withTemp.length === 0) return null;
  const points = withTemp.slice(-8).map((o) => o.temperature);
  const last = points[points.length - 1];
  return { points, last, elevated: last >= FEVER_THRESHOLD };
}

export interface EndProtocolItem {
  label: string;
  state: "ok" | "warn" | "todo";
}

export interface EndProtocol {
  items: EndProtocolItem[];
  /** Lze ukončit? (u izolace je vet. souhlas povinný) */
  canEnd: boolean;
  blockReason: string | null;
}

/**
 * Vyhodnotí protokol ukončení dohledu. „Bez horečky" = žádné pozorování
 * s teplotou ≥ prahu za posledních 48 h. U izolace je vet. souhlas povinný.
 */
export function endProtocol(
  kind: AnimalSupervisionStatus,
  params: {
    startedOn: string;
    plannedUntil: string | null;
    vetConsent: boolean;
    observations: { temperature: number | null; observed_at: string }[];
  },
  now: Date = new Date(),
): EndProtocol {
  const recent = params.observations.filter(
    (o) => now.getTime() - new Date(o.observed_at).getTime() <= 2 * DAY_MS,
  );
  const feverFree = !recent.some(
    (o) => o.temperature != null && o.temperature >= FEVER_THRESHOLD,
  );

  const day = episodeDay(params.startedOn, now);
  const rec = recommendedDays(params.startedOn, params.plannedUntil);
  const lengthOk = rec == null ? true : day >= rec;

  const items: EndProtocolItem[] = [
    { label: "Bez horečky 48 h", state: feverFree ? "ok" : "warn" },
    {
      label: rec == null ? "Délka dohledu" : `Doporučená délka ${day}/${rec} dní`,
      state: lengthOk ? "ok" : "warn",
    },
    {
      label:
        kind === "isolation"
          ? "Vet. souhlas (povinný u izolace)"
          : "Vet. souhlas (volitelné u karantény)",
      state: params.vetConsent ? "ok" : kind === "isolation" ? "todo" : "warn",
    },
  ];

  const canEnd = kind === "isolation" ? params.vetConsent : true;
  return {
    items,
    canEnd,
    blockReason: canEnd ? null : "U izolace je k ukončení nutný veterinární souhlas.",
  };
}
