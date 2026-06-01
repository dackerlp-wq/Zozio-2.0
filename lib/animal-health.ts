/**
 * Čisté pomocné funkce zdravotní záložky — bez DB a side-efektů.
 * Platnost vakcín, trend váhy, denní medikační sloty + výstrahy,
 * aktivita léčby a odvození zdravotního stavu z medikace.
 */
import type { HealthStatus, TreatmentRow } from "@/types/database";

const DAY_MS = 86_400_000;
const VAX_EXPIRING_DAYS = 30;

// --- Platnost vakcín -------------------------------------------------------

export type VaxStatus = "valid" | "expiring" | "expired" | "unknown";

export function vaccineStatus(
  validUntil: string | null,
  now: Date = new Date(),
): VaxStatus {
  if (!validUntil) return "unknown";
  const end = new Date(validUntil + "T00:00:00").getTime();
  const t = now.getTime();
  if (end < t) return "expired";
  if (end < t + VAX_EXPIRING_DAYS * DAY_MS) return "expiring";
  return "valid";
}

// --- Trend váhy ------------------------------------------------------------

export interface WeightTrend {
  last: number;
  deltaKg: number | null;
  points: number[];
}

export function weightTrend(
  logs: { weight_kg: number; measured_at: string }[],
): WeightTrend | null {
  if (!logs.length) return null;
  const sorted = [...logs].sort((a, b) =>
    a.measured_at.localeCompare(b.measured_at),
  );
  const last = sorted[sorted.length - 1].weight_kg;
  const prev = sorted.length >= 2 ? sorted[sorted.length - 2].weight_kg : null;
  const points = sorted.slice(-6).map((l) => l.weight_kg);
  return { last, deltaKg: prev == null ? null : last - prev, points };
}

// --- Aktivita léčby + odvození zdravotního stavu ---------------------------

export function isTreatmentActive(
  t: Pick<TreatmentRow, "start_date" | "end_date">,
  today: string = new Date().toISOString().slice(0, 10),
): boolean {
  const startsOk = !t.start_date || t.start_date <= today;
  const endsOk = !t.end_date || t.end_date >= today;
  return startsOk && endsOk;
}

/**
 * Zobrazený zdravotní stav: běží-li aktivní léčba, ukáže „treated" (V léčbě).
 * Jinak ponechá uložený stav. Ruční přepis se ukládá do `health_status`.
 */
export function displayHealthStatus(
  stored: HealthStatus,
  hasActiveTreatment: boolean,
): { value: HealthStatus; derived: boolean } {
  if (hasActiveTreatment && stored !== "special_needs" && stored !== "treated") {
    return { value: "treated", derived: true };
  }
  return { value: stored, derived: false };
}

// --- Denní medikační sloty + výstrahy --------------------------------------

export type SlotStatus = "done" | "missed" | "now" | "upcoming";

export interface DoseSlot {
  slot: string; // "08:00"
  status: SlotStatus;
  givenAt?: string | null;
}

/** Okno kolem aktuálního času, kdy je slot „právě teď" (± 90 min). */
const NOW_WINDOW_MS = 90 * 60_000;

export function todaySlots(
  scheduleTimes: string[] | null,
  doses: { slot: string | null; given_at: string | null; due_on: string }[],
  today: string = new Date().toISOString().slice(0, 10),
  now: Date = new Date(),
): DoseSlot[] {
  if (!scheduleTimes || scheduleTimes.length === 0) return [];
  const todays = doses.filter((d) => d.due_on === today);
  return scheduleTimes
    .slice()
    .sort()
    .map((slot) => {
      const dose = todays.find((d) => d.slot === slot);
      if (dose?.given_at) {
        return { slot, status: "done" as SlotStatus, givenAt: dose.given_at };
      }
      const [h, m] = slot.split(":").map((x) => parseInt(x, 10));
      const slotTime = new Date(now);
      slotTime.setHours(h || 0, m || 0, 0, 0);
      const diff = now.getTime() - slotTime.getTime();
      let status: SlotStatus;
      if (diff > NOW_WINDOW_MS) status = "missed";
      else if (diff >= -NOW_WINDOW_MS) status = "now";
      else status = "upcoming";
      return { slot, status };
    });
}

export interface MedicationAlerts {
  missedToday: number;
  hasNow: boolean;
  endingSoon: boolean; // kúra končí dnes/zítra
  permanent: boolean; // trvalá medikace bez termínu
}

export function medicationAlerts(
  slots: DoseSlot[],
  endDate: string | null,
  today: string = new Date().toISOString().slice(0, 10),
): MedicationAlerts {
  const missedToday = slots.filter((s) => s.status === "missed").length;
  const hasNow = slots.some((s) => s.status === "now");
  let endingSoon = false;
  if (endDate) {
    const end = new Date(endDate + "T00:00:00").getTime();
    const t = new Date(today + "T00:00:00").getTime();
    endingSoon = end - t <= DAY_MS && end - t >= 0;
  }
  return { missedToday, hasNow, endingSoon, permanent: !endDate };
}

/** Počet dní do konce kúry (může být záporný); null bez termínu. */
export function daysUntilEnd(
  endDate: string | null,
  today: string = new Date().toISOString().slice(0, 10),
): number | null {
  if (!endDate) return null;
  const end = new Date(endDate + "T00:00:00").getTime();
  const t = new Date(today + "T00:00:00").getTime();
  return Math.round((end - t) / DAY_MS);
}
