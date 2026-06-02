/**
 * Pomocné funkce pro admin Přehled — bez DB.
 * Stavové počty, „připraveno k adopci, ne na webu" (dle logiky zveřejnění)
 * a období pro trendy.
 */
import { publishReadiness, type ReadinessInput } from "./animal-readiness";
import type { AdoptionStatus, AnimalSupervisionStatus } from "@/types/database";

export type DashboardPeriod = "today" | "week" | "month";

export const DASHBOARD_PERIODS: { key: DashboardPeriod; label: string; days: number }[] = [
  { key: "today", label: "Dnes", days: 1 },
  { key: "week", label: "Týden", days: 7 },
  { key: "month", label: "Měsíc", days: 30 },
];

/** Začátek období (ISO datum) pro počítání „nově přidaných" v období. */
export function periodStartISO(period: DashboardPeriod): string {
  const days = DASHBOARD_PERIODS.find((p) => p.key === period)?.days ?? 1;
  const d = new Date();
  d.setDate(d.getDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

export function parsePeriod(raw: string | undefined): DashboardPeriod {
  return raw === "week" || raw === "month" ? raw : "today";
}

/** Stavy, kdy zvíře už opustilo útulek / zemřelo (z webu se nenabízí). */
export const CLOSED_STATUSES: AdoptionStatus[] = [
  "adopted",
  "transferred",
  "deceased",
  "returned",
];

export interface DashAnimal extends ReadinessInput {
  id: string;
  name: string;
  adoption_status: AdoptionStatus;
  created_at: string;
  kennel_id: string | null;
  protection_until: string | null;
}

const inProtection = (a: DashAnimal) => a.legal_status === "in_protection";
const inSupervision = (s: AnimalSupervisionStatus) => s === "quarantine" || s === "isolation";

/**
 * „Připraveno k adopci, ale není na webu" — POZOR na logiku zveřejnění:
 * jen `shelter_owned` (NE v ochranné lhůtě), splněné hradlo `publish`
 * a zatím není `available` ani uzavřené. Psi v lhůtě se sem NEPOČÍTAJÍ.
 */
export function isReadyNotPublished(a: DashAnimal): boolean {
  if (a.legal_status !== "shelter_owned") return false;
  if (a.adoption_status === "available" || CLOSED_STATUSES.includes(a.adoption_status)) {
    return false;
  }
  return publishReadiness(a).ready;
}

export interface DashboardStateCounts {
  inProtection: number;
  inSupervision: number;
  longStay: number;
  readyNotPublished: number;
}

export function computeStateCounts(animals: DashAnimal[], todayStr: string): DashboardStateCounts {
  const longStayBefore = new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
  let prot = 0;
  let sup = 0;
  let longStay = 0;
  let ready = 0;
  for (const a of animals) {
    const open = !CLOSED_STATUSES.includes(a.adoption_status);
    if (inProtection(a)) prot++;
    if (open && inSupervision(a.supervision_status)) sup++;
    // Dlouhodobec: stále v útulku (otevřený) a přijatý před 90+ dny.
    if (open && a.intake_date && a.intake_date <= longStayBefore) longStay++;
    if (isReadyNotPublished(a)) ready++;
  }
  return { inProtection: prot, inSupervision: sup, longStay, readyNotPublished: ready };
}
