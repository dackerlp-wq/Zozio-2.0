/**
 * Pomocné funkce pro pravidelné (opakované) úkoly — výpočet dalšího termínu
 * podle frekvence a intervalu. Čisté funkce bez DB, sdílí je server akce
 * (vytvoření/úprava šablony) i denní cron (materializace úkolů).
 */
import type { TaskScheduleFreq } from "@/types/database";

const DAY_MS = 86_400_000;

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Posune datum (YYYY-MM-DD) o `interval` jednotek dané frekvence. */
export function advanceDate(
  isoDate: string,
  freq: TaskScheduleFreq,
  interval: number,
): string {
  const step = Math.max(1, Math.trunc(interval));
  const d = new Date(isoDate + "T00:00:00Z");
  switch (freq) {
    case "daily":
      d.setUTCDate(d.getUTCDate() + step);
      break;
    case "weekly":
      d.setUTCDate(d.getUTCDate() + step * 7);
      break;
    case "monthly":
      d.setUTCMonth(d.getUTCMonth() + step);
      break;
    case "yearly":
      d.setUTCFullYear(d.getUTCFullYear() + step);
      break;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * První termín opakování od `start` — je-li start v minulosti, posouvá se
 * vpřed po krocích, dokud nedosáhne dneška (ať cron nezahltí historií).
 */
export function firstRunFrom(
  start: string,
  freq: TaskScheduleFreq,
  interval: number,
  todayStr: string = todayISO(),
): string {
  let run = start;
  // Bezpečnostní strop (max ~10 000 kroků) proti zacyklení.
  let guard = 0;
  while (run < todayStr && guard < 10_000) {
    run = advanceDate(run, freq, interval);
    guard += 1;
  }
  return run;
}

/** Datum o `days` dní dříve (pro předstih vzniku úkolu). */
export function subtractDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00Z");
  return new Date(d.getTime() - days * DAY_MS).toISOString().slice(0, 10);
}

/** Vstup pro výpočet termínů opakování. */
export interface PlannedRunsInput {
  next_run: string;
  freq: TaskScheduleFreq;
  interval: number;
  lead_days: number;
  end_date: string | null;
}

/**
 * Spočítá termíny opakování, jejichž předstih už nastal k `today` — stejná
 * logika jako denní cron. Vrací seznam dat ke vzniku úkolu plus nový
 * `next_run` a zda šablona zůstává aktivní. Slouží k okamžité materializaci
 * úkolů hned po založení šablony (ať uživatel nečeká na noční cron).
 */
export function plannedRuns(
  s: PlannedRunsInput,
  today: string = todayISO(),
): { runs: string[]; nextRun: string; active: boolean } {
  const runs: string[] = [];
  let run = s.next_run;
  let active = true;
  let guard = 0;
  while (guard < 1000) {
    guard += 1;
    if (s.end_date && run > s.end_date) {
      active = false;
      break;
    }
    if (subtractDays(run, s.lead_days) > today) break;
    runs.push(run);
    run = advanceDate(run, s.freq, s.interval);
  }
  return { runs, nextRun: run, active };
}
