/**
 * Agregace statistik útulku — reálná data ze Supabase, scoped institution_id.
 * Žádné natvrdo zadané hodnoty. JS agregace (objem dat útulku je malý).
 */
import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import { SPECIES_LABEL, ANIMAL_INTAKE_TYPE_LABEL, ANIMAL_COST_CATEGORY_LABEL } from "@/lib/format";
import type {
  AnimalCostCategory,
  AnimalExitType,
  AnimalIntakeType,
  Species,
} from "@/types/database";

type Service = ReturnType<typeof createServiceClient>;

export interface Period {
  from: string;
  to: string;
  label: string;
}

export type PeriodKind = "month" | "year" | "custom";

const MONTHS_CZ = ["led", "úno", "bře", "dub", "kvě", "čer", "čvc", "srp", "zář", "říj", "lis", "pro"];

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Vyřeší aktuální a předchozí období z parametrů. */
export function resolvePeriods(
  kind: PeriodKind,
  fromParam?: string | null,
  toParam?: string | null,
): { current: Period; previous: Period } {
  const now = new Date();
  if (kind === "month") {
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const pFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const pTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    return {
      current: { from: iso(from), to: iso(to), label: `${MONTHS_CZ[from.getUTCMonth()]} ${from.getUTCFullYear()}` },
      previous: { from: iso(pFrom), to: iso(pTo), label: `${MONTHS_CZ[pFrom.getUTCMonth()]} ${pFrom.getUTCFullYear()}` },
    };
  }
  if (kind === "custom" && fromParam && toParam) {
    const f = new Date(fromParam + "T00:00:00Z");
    const t = new Date(toParam + "T00:00:00Z");
    const len = t.getTime() - f.getTime();
    const pTo = new Date(f.getTime() - 86_400_000);
    const pFrom = new Date(pTo.getTime() - len);
    return {
      current: { from: fromParam, to: toParam, label: `${fromParam} – ${toParam}` },
      previous: { from: iso(pFrom), to: iso(pTo), label: `${iso(pFrom)} – ${iso(pTo)}` },
    };
  }
  // year (default)
  const y = now.getUTCFullYear();
  return {
    current: { from: `${y}-01-01`, to: `${y}-12-31`, label: String(y) },
    previous: { from: `${y - 1}-01-01`, to: `${y - 1}-12-31`, label: String(y - 1) },
  };
}

/** Měsíční koše v rozsahu (max 24). */
function monthBuckets(range: Period): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const start = new Date(range.from + "T00:00:00Z");
  const end = new Date(range.to + "T00:00:00Z");
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  while (cur <= end && out.length < 24) {
    const key = `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, "0")}`;
    out.push({ key, label: MONTHS_CZ[cur.getUTCMonth()] });
    cur.setUTCMonth(cur.getUTCMonth() + 1);
  }
  return out;
}
const monthKey = (d: string) => d.slice(0, 7);

export interface NameValue {
  name: string;
  value: number;
}
export interface StatsData {
  // KPI hlavní
  intake: number;
  adopted: number;
  outTotal: number;
  inShelter: number;
  avgStayDays: number | null;
  adoptionRate: number | null;
  costs: number;
  donations: number;
  // grafy
  monthly: { label: string; intake: number; out: number }[];
  monthlyTable: { label: string; intake: number; out: number }[];
  exitBreakdown: NameValue[];
  stayDistribution: NameValue[];
  speciesBreakdown: NameValue[];
  intakeReasons: NameValue[];
  // adopce
  adoptionFunnel: NameValue[];
  adoptionsBySpecies: NameValue[];
  rejectionReasons: NameValue[];
  avgDaysToAdopt: number | null;
  returnRate: number | null;
  // pěstouni
  fosterCount: number;
  inFosterCare: number;
  avgFosterDays: number | null;
  fosterToAdopt: number | null;
  fosterCapacity: { name: string; used: number; cap: number }[];
  topFosters: { name: string; total: number; now: number; avg: number | null }[];
  // obsazenost
  capacity: number;
  avgOccupancy: number | null;
  freeNow: number;
  occupancyByZone: { name: string; pct: number }[];
  // finance
  balance: number;
  avgCostPerAnimal: number | null;
  costsVsDonations: { label: string; costs: number; donations: number }[];
  costsByCategory: NameValue[];
  topCostAnimals: { name: string; costs: number; covered: number; balance: number }[];
  // web
  webVisits: number;
  webApplications: number;
  webConversion: number | null;
  visitsOverTime: { label: string; value: number }[];
  topAnimalsByViews: NameValue[];
  hasWebData: boolean;
}

function applyRange<T>(q: T, col: string, r: Period): T {
  const x = q as unknown as { gte: (c: string, v: string) => typeof x; lte: (c: string, v: string) => typeof x };
  return x.gte(col, r.from).lte(col, r.to) as unknown as T;
}

const TERMINAL = ["adopted", "transferred", "deceased", "returned"];

export async function loadStats(institutionId: string, range: Period): Promise<StatsData> {
  const s: Service = createServiceClient();
  const buckets = monthBuckets(range);
  const bIdx = new Map(buckets.map((b, i) => [b.key, i]));

  const [
    intakeRows,
    adoptionRows,
    appRows,
    exitRows,
    fosterRows,
    carerRows,
    kennelRows,
    currentAnimals,
    costRows,
    donationRows,
    viewRows,
  ] = await Promise.all([
    applyRange(
      s.from("animals").select("id, species, intake_type, intake_date").eq("institution_id", institutionId),
      "intake_date",
      range,
    ).then((r) => (r.data ?? []) as { id: string; species: Species; intake_type: AnimalIntakeType | null; intake_date: string | null }[]),
    applyRange(
      s.from("adoptions").select("finalized_on, fee, stage, animals!inner(species, intake_date, name)").eq("institution_id", institutionId).eq("stage", "finalized"),
      "finalized_on",
      range,
    ).then((r) => (r.data ?? []) as { finalized_on: string | null; fee: number | null; animals: { species: Species; intake_date: string | null; name: string } }[]),
    applyRange(
      s.from("applications").select("status, rejection_reason, created_at").eq("institution_id", institutionId),
      "created_at",
      range,
    ).then((r) => (r.data ?? []) as { status: string; rejection_reason: string | null; created_at: string }[]),
    applyRange(
      s.from("animal_exit_records").select("kind, occurred_on, reason").eq("institution_id", institutionId),
      "occurred_on",
      range,
    ).then((r) => (r.data ?? []) as { kind: AnimalExitType; occurred_on: string; reason: string | null }[]),
    applyRange(
      s.from("foster_placements").select("started_on, ended_on, end_reason, carer_id, foster_carers(name)").eq("institution_id", institutionId),
      "started_on",
      range,
    ).then((r) => (r.data ?? []) as { started_on: string; ended_on: string | null; end_reason: string | null; carer_id: string; foster_carers: { name: string } | null }[]),
    s.from("foster_carers").select("id, name, capacity, is_active").eq("institution_id", institutionId).then((r) => (r.data ?? []) as { id: string; name: string; capacity: number | null; is_active: boolean }[]),
    s.from("kennels").select("id, capacity, status, zone").eq("institution_id", institutionId).then((r) => (r.data ?? []) as { id: string; capacity: number; status: string; zone: string | null }[]),
    s.from("animals").select("id, kennel_id, adoption_status").eq("institution_id", institutionId).not("adoption_status", "in", `(${TERMINAL.join(",")})`).then((r) => (r.data ?? []) as { id: string; kennel_id: string | null; adoption_status: string }[]),
    applyRange(
      s.from("animal_costs").select("amount, category, spent_on, animal_id, animals(name)").eq("institution_id", institutionId),
      "spent_on",
      range,
    ).then((r) => (r.data ?? []) as { amount: number; category: AnimalCostCategory; spent_on: string; animal_id: string; animals: { name: string } | null }[]),
    applyRange(
      s.from("animal_donations").select("amount, occurred_on, animal_id").eq("institution_id", institutionId).not("amount", "is", null),
      "occurred_on",
      range,
    ).then((r) => (r.data ?? []) as { amount: number | null; occurred_on: string; animal_id: string }[]),
    applyRange(
      s.from("animal_profile_views").select("count, day, animal_id, animals(name)").eq("institution_id", institutionId),
      "day",
      range,
    ).then((r) => (r.data ?? []) as { count: number; day: string; animal_id: string; animals: { name: string } | null }[]),
  ]);

  // --- Měsíční příjmy/výdeje ---
  const monthly = buckets.map((b) => ({ label: b.label, intake: 0, out: 0 }));
  for (const a of intakeRows) {
    if (a.intake_date) {
      const i = bIdx.get(monthKey(a.intake_date));
      if (i != null) monthly[i].intake += 1;
    }
  }
  const outAll: string[] = [];
  for (const ad of adoptionRows) if (ad.finalized_on) outAll.push(ad.finalized_on);
  for (const e of exitRows) outAll.push(e.occurred_on);
  for (const d of outAll) {
    const i = bIdx.get(monthKey(d));
    if (i != null) monthly[i].out += 1;
  }

  // --- KPI ---
  const intake = intakeRows.length;
  const adopted = adoptionRows.length;
  const deaths = exitRows.filter((e) => e.kind === "death" || e.kind === "euthanasia").length;
  const returns = exitRows.filter((e) => e.kind === "return").length;
  const transfers = exitRows.filter((e) => e.kind === "return" ? false : false).length; // transfer není v exit enum
  const outTotal = adopted + deaths + returns;
  const adoptionRate = outTotal > 0 ? Math.round((adopted / outTotal) * 100) : null;
  const stays = adoptionRows
    .map((a) => (a.finalized_on && a.animals.intake_date ? Math.round((+new Date(a.finalized_on) - +new Date(a.animals.intake_date)) / 86_400_000) : null))
    .filter((d): d is number => d != null && d >= 0);
  const avgStayDays = stays.length ? Math.round(stays.reduce((x, y) => x + y, 0) / stays.length) : null;
  const costs = costRows.reduce((x, c) => x + (c.amount ?? 0), 0);
  const donations = donationRows.reduce((x, d) => x + (d.amount ?? 0), 0);
  const inShelter = currentAnimals.length;

  // --- Skladba výdejů ---
  const exitBreakdown: NameValue[] = [
    { name: "Adopce", value: adopted },
    { name: "Návrat", value: returns },
    { name: "Úhyn", value: deaths },
  ].filter((x) => x.value > 0);
  void transfers;

  // --- Délka pobytu (distribuce) ---
  const distBins = [0, 0, 0, 0, 0];
  for (const d of stays) {
    if (d < 7) distBins[0] += 1;
    else if (d < 28) distBins[1] += 1;
    else if (d < 90) distBins[2] += 1;
    else if (d < 180) distBins[3] += 1;
    else distBins[4] += 1;
  }
  const stayDistribution: NameValue[] = [
    { name: "<1 týd", value: distBins[0] },
    { name: "1–4 týd", value: distBins[1] },
    { name: "1–3 měs", value: distBins[2] },
    { name: "3–6 měs", value: distBins[3] },
    { name: "6+ měs", value: distBins[4] },
  ];

  // --- Druhové složení (přijatá v období) ---
  const spCount = new Map<Species, number>();
  for (const a of intakeRows) spCount.set(a.species, (spCount.get(a.species) ?? 0) + 1);
  const speciesBreakdown: NameValue[] = [...spCount.entries()].map(([sp, v]) => ({ name: SPECIES_LABEL[sp] ?? sp, value: v }));

  // --- Důvody příjmu ---
  const reasonCount = new Map<string, number>();
  for (const a of intakeRows) {
    const lbl = a.intake_type ? ANIMAL_INTAKE_TYPE_LABEL[a.intake_type] : "Neuvedeno";
    reasonCount.set(lbl, (reasonCount.get(lbl) ?? 0) + 1);
  }
  const intakeReasons: NameValue[] = [...reasonCount.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);

  // --- Adopční trychtýř (žádosti dle stavu) ---
  const total = appRows.length;
  const screened = appRows.filter((a) => !["new"].includes(a.status)).length;
  const approved = appRows.filter((a) => ["approved", "in_person_meeting", "contract_signed", "completed"].includes(a.status)).length;
  const trial = appRows.filter((a) => ["contract_signed", "completed"].includes(a.status)).length;
  const finalized = appRows.filter((a) => a.status === "completed").length;
  const adoptionFunnel: NameValue[] = [
    { name: "Žádosti", value: total },
    { name: "Skríning", value: screened },
    { name: "Schváleno", value: approved },
    { name: "Zkušebka", value: trial },
    { name: "Dokončeno", value: finalized },
  ];

  // --- Adopce dle druhu ---
  const adSp = new Map<Species, number>();
  for (const a of adoptionRows) adSp.set(a.animals.species, (adSp.get(a.animals.species) ?? 0) + 1);
  const adoptionsBySpecies: NameValue[] = [...adSp.entries()].map(([sp, v]) => ({ name: SPECIES_LABEL[sp] ?? sp, value: v }));

  // --- Důvody zamítnutí ---
  const rejMap = new Map<string, number>();
  for (const a of appRows) if (a.status === "rejected" && a.rejection_reason) rejMap.set(a.rejection_reason, (rejMap.get(a.rejection_reason) ?? 0) + 1);
  const rejectionReasons: NameValue[] = [...rejMap.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);

  const adStays = adoptionRows
    .map((a) => (a.finalized_on && a.animals.intake_date ? Math.round((+new Date(a.finalized_on) - +new Date(a.animals.intake_date)) / 86_400_000) : null))
    .filter((d): d is number => d != null && d >= 0);
  const avgDaysToAdopt = adStays.length ? Math.round(adStays.reduce((x, y) => x + y, 0) / adStays.length) : null;
  const returnRate = adopted + returns > 0 ? Math.round((returns / (adopted + returns)) * 100) : null;

  // --- Pěstouni ---
  const activeFoster = fosterRows.filter((f) => !f.ended_on);
  const inFosterCare = activeFoster.length;
  const fosterDurations = fosterRows.filter((f) => f.ended_on).map((f) => Math.round((+new Date(f.ended_on!) - +new Date(f.started_on)) / 86_400_000)).filter((d) => d >= 0);
  const avgFosterDays = fosterDurations.length ? Math.round(fosterDurations.reduce((x, y) => x + y, 0) / fosterDurations.length) : null;
  const fosterAdoptCount = fosterRows.filter((f) => f.end_reason && /adop/i.test(f.end_reason)).length;
  const fosterEnded = fosterRows.filter((f) => f.ended_on).length;
  const fosterToAdopt = fosterEnded > 0 ? Math.round((fosterAdoptCount / fosterEnded) * 100) : null;
  const fosterCount = carerRows.filter((c) => c.is_active).length;

  const activeByCarer = new Map<string, number>();
  for (const f of activeFoster) activeByCarer.set(f.carer_id, (activeByCarer.get(f.carer_id) ?? 0) + 1);
  const fosterCapacity = carerRows
    .filter((c) => c.is_active)
    .map((c) => ({ name: c.name, used: activeByCarer.get(c.id) ?? 0, cap: c.capacity ?? 0 }))
    .sort((a, b) => (b.cap ? b.used / b.cap : 0) - (a.cap ? a.used / a.cap : 0));

  const totalByCarer = new Map<string, { total: number; now: number; durations: number[]; name: string }>();
  for (const f of fosterRows) {
    const e = totalByCarer.get(f.carer_id) ?? { total: 0, now: 0, durations: [], name: f.foster_carers?.name ?? "—" };
    e.total += 1;
    if (!f.ended_on) e.now += 1;
    else e.durations.push(Math.round((+new Date(f.ended_on) - +new Date(f.started_on)) / 86_400_000));
    totalByCarer.set(f.carer_id, e);
  }
  const topFosters = [...totalByCarer.values()]
    .map((e) => ({ name: e.name, total: e.total, now: e.now, avg: e.durations.length ? Math.round(e.durations.reduce((x, y) => x + y, 0) / e.durations.length) : null }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  // --- Obsazenost (aktuální stav) ---
  const activeKennels = kennelRows.filter((k) => k.status === "active");
  const capacity = activeKennels.reduce((x, k) => x + k.capacity, 0);
  const occByKennel = new Map<string, number>();
  for (const a of currentAnimals) if (a.kennel_id) occByKennel.set(a.kennel_id, (occByKennel.get(a.kennel_id) ?? 0) + 1);
  const occupiedNow = [...occByKennel.values()].reduce((x, y) => x + y, 0);
  const freeNow = Math.max(0, capacity - occupiedNow);
  const avgOccupancy = capacity > 0 ? Math.round((occupiedNow / capacity) * 100) : null;
  const zoneMap = new Map<string, { used: number; cap: number }>();
  for (const k of activeKennels) {
    const z = k.zone ?? "Bez zóny";
    const e = zoneMap.get(z) ?? { used: 0, cap: 0 };
    e.cap += k.capacity;
    e.used += occByKennel.get(k.id) ?? 0;
    zoneMap.set(z, e);
  }
  const occupancyByZone = [...zoneMap.entries()].map(([name, e]) => ({ name, pct: e.cap ? Math.round((e.used / e.cap) * 100) : 0 })).sort((a, b) => b.pct - a.pct);

  // --- Finance ---
  const balance = donations - costs;
  const animalsWithCost = new Set(costRows.map((c) => c.animal_id));
  const avgCostPerAnimal = animalsWithCost.size ? Math.round(costs / animalsWithCost.size) : null;
  const cvd = buckets.map((b) => ({ label: b.label, costs: 0, donations: 0 }));
  for (const c of costRows) {
    const i = bIdx.get(monthKey(c.spent_on));
    if (i != null) cvd[i].costs += c.amount ?? 0;
  }
  for (const d of donationRows) {
    const i = bIdx.get(monthKey(d.occurred_on));
    if (i != null) cvd[i].donations += d.amount ?? 0;
  }
  const catMap = new Map<AnimalCostCategory, number>();
  for (const c of costRows) catMap.set(c.category, (catMap.get(c.category) ?? 0) + (c.amount ?? 0));
  const costsByCategory: NameValue[] = [...catMap.entries()].map(([cat, v]) => ({ name: ANIMAL_COST_CATEGORY_LABEL[cat], value: v })).sort((a, b) => b.value - a.value);
  const costByAnimal = new Map<string, { name: string; costs: number }>();
  for (const c of costRows) {
    const e = costByAnimal.get(c.animal_id) ?? { name: c.animals?.name ?? "—", costs: 0 };
    e.costs += c.amount ?? 0;
    costByAnimal.set(c.animal_id, e);
  }
  const coverByAnimal = new Map<string, number>();
  for (const d of donationRows) coverByAnimal.set(d.animal_id, (coverByAnimal.get(d.animal_id) ?? 0) + (d.amount ?? 0));
  const topCostAnimals = [...costByAnimal.entries()]
    .map(([id, e]) => {
      const covered = coverByAnimal.get(id) ?? 0;
      return { name: e.name, costs: e.costs, covered, balance: covered - e.costs };
    })
    .sort((a, b) => b.costs - a.costs)
    .slice(0, 5);

  // --- Web ---
  const webVisits = viewRows.reduce((x, v) => x + v.count, 0);
  const webApplications = appRows.length;
  const webConversion = webVisits > 0 ? Math.round((webApplications / webVisits) * 1000) / 10 : null;
  const visitsByMonth = buckets.map((b) => ({ label: b.label, value: 0 }));
  for (const v of viewRows) {
    const i = bIdx.get(monthKey(v.day));
    if (i != null) visitsByMonth[i].value += v.count;
  }
  const viewsByAnimal = new Map<string, { name: string; value: number }>();
  for (const v of viewRows) {
    const e = viewsByAnimal.get(v.animal_id) ?? { name: v.animals?.name ?? "—", value: 0 };
    e.value += v.count;
    viewsByAnimal.set(v.animal_id, e);
  }
  const topAnimalsByViews = [...viewsByAnimal.values()].sort((a, b) => b.value - a.value).slice(0, 6);

  return {
    intake, adopted, outTotal, inShelter, avgStayDays, adoptionRate, costs, donations,
    monthly, monthlyTable: monthly,
    exitBreakdown, stayDistribution, speciesBreakdown, intakeReasons,
    adoptionFunnel, adoptionsBySpecies, rejectionReasons, avgDaysToAdopt, returnRate,
    fosterCount, inFosterCare, avgFosterDays, fosterToAdopt, fosterCapacity, topFosters,
    capacity, avgOccupancy, freeNow, occupancyByZone,
    balance, avgCostPerAnimal, costsVsDonations: cvd, costsByCategory, topCostAnimals,
    webVisits, webApplications, webConversion, visitsOverTime: visitsByMonth, topAnimalsByViews,
    hasWebData: webVisits > 0,
  };
}
