/**
 * Sdílené definice datových přehledů pro Evidenci & exporty.
 *
 * Každý přehled vrací `{ headers, rows }` nezávisle na výstupním formátu —
 * stejná data pohánějí CSV, XLSX, náhled i ZIP balíček. Vše scoped na
 * `institution_id` (multi-tenant). Datové moduly jen čteme.
 */
import "server-only";

import {
  ADOPTION_STATUS_LABEL,
  ANIMAL_COST_CATEGORY_LABEL,
  ANIMAL_EXIT_TYPE_LABEL,
  ANIMAL_INTAKE_TYPE_LABEL,
  ANIMAL_LEGAL_STATUS_LABEL,
  SEX_LABEL,
  SPECIES_LABEL,
  SUPERVISION_STATUS_LABEL,
} from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";
import { REPORT_DEFS, REPORT_HEADERS, type ReportKey } from "@/lib/exports/report-defs";
import type {
  AdoptionStatus,
  AnimalCostCategory,
  AnimalExitType,
  AnimalIntakeType,
  AnimalLegalStatus,
  AnimalSupervisionStatus,
  Sex,
  Species,
} from "@/types/database";

export { REPORT_DEFS, REPORT_HEADERS };
export type { ReportKey };

export type Cell = string | number | null | undefined;
export interface ReportData {
  headers: string[];
  rows: Cell[][];
}
export interface Range {
  from: string | null;
  to: string | null;
}

const DEF_BY_KEY = new Map(REPORT_DEFS.map((d) => [d.key, d]));
export function reportDef(key: ReportKey) {
  return DEF_BY_KEY.get(key);
}

type Service = ReturnType<typeof createServiceClient>;

function applyRange<T>(query: T, column: string, range: Range): T {
  let q = query as unknown as {
    gte: (c: string, v: string) => typeof q;
    lte: (c: string, v: string) => typeof q;
  };
  if (range.from) q = q.gte(column, range.from);
  if (range.to) q = q.lte(column, range.to);
  return q as unknown as T;
}

/** Sestaví jeden datový přehled. */
export async function buildReport(
  service: Service,
  institutionId: string,
  key: ReportKey,
  range: Range,
): Promise<ReportData> {
  switch (key) {
    case "intake":
      return intake(service, institutionId, range);
    case "output":
      return output(service, institutionId, range);
    case "escapes":
      return escapes(service, institutionId, range);
    case "deaths":
      return deaths(service, institutionId, range);
    case "health":
      return health(service, institutionId, range);
    case "quarantine_vacc":
      return quarantineVacc(service, institutionId, range);
    case "foster":
      return foster(service, institutionId, range);
    case "accounting":
      return accounting(service, institutionId, range);
  }
}

// ---- Přijatá zvířata -------------------------------------------------------
async function intake(s: Service, inst: string, range: Range): Promise<ReportData> {
  let q = s
    .from("animals")
    .select(
      "record_number, name, species, sex, intake_type, intake_date, found_date, found_location, original_owner, legal_status, protection_until, chip_number, adoption_status",
    )
    .eq("institution_id", inst)
    .order("intake_date", { ascending: false, nullsFirst: false });
  q = applyRange(q, "intake_date", range);
  const { data } = await q;
  const rows = ((data ?? []) as Array<{
    record_number: string | null;
    name: string;
    species: Species;
    sex: Sex;
    intake_type: AnimalIntakeType | null;
    intake_date: string | null;
    found_date: string | null;
    found_location: string | null;
    original_owner: string | null;
    legal_status: AnimalLegalStatus;
    protection_until: string | null;
    chip_number: string | null;
    adoption_status: AdoptionStatus;
  }>).map((a) => [
    a.record_number,
    a.name,
    SPECIES_LABEL[a.species] ?? a.species,
    SEX_LABEL[a.sex] ?? a.sex,
    a.intake_type ? ANIMAL_INTAKE_TYPE_LABEL[a.intake_type] : "",
    a.intake_date ?? a.found_date ?? "",
    a.found_location,
    a.original_owner,
    ANIMAL_LEGAL_STATUS_LABEL[a.legal_status],
    a.protection_until,
    a.chip_number,
    ADOPTION_STATUS_LABEL[a.adoption_status],
  ]);
  return {
    headers: [
      "Číslo záznamu",
      "Jméno",
      "Druh",
      "Pohlaví",
      "Způsob příjmu",
      "Datum příjmu",
      "Místo nálezu",
      "Původní majitel",
      "Právní stav",
      "Ochranná lhůta do",
      "Čip",
      "Stav",
    ],
    rows,
  };
}

// ---- Vydaná zvířata --------------------------------------------------------
async function output(s: Service, inst: string, range: Range): Promise<ReportData> {
  let adQ = s
    .from("adoptions")
    .select(
      "finalized_on, adopter_name, fee, animals!inner(name, species, record_number)",
    )
    .eq("institution_id", inst)
    .eq("stage", "finalized");
  adQ = applyRange(adQ, "finalized_on", range);
  const { data: adData } = await adQ;

  let exQ = s
    .from("animal_exit_records")
    .select("kind, occurred_on, animals!inner(name, species, record_number)")
    .eq("institution_id", inst);
  exQ = applyRange(exQ, "occurred_on", range);
  const { data: exData } = await exQ;

  const rows: Cell[][] = [];
  for (const a of (adData ?? []) as Array<{
    finalized_on: string | null;
    adopter_name: string;
    fee: number | null;
    animals: { name: string; species: Species; record_number: string | null };
  }>) {
    rows.push([
      a.animals.record_number,
      a.animals.name,
      SPECIES_LABEL[a.animals.species] ?? a.animals.species,
      "Adopce",
      a.finalized_on,
      a.adopter_name,
      a.fee,
    ]);
  }
  for (const e of (exData ?? []) as Array<{
    kind: AnimalExitType;
    occurred_on: string;
    animals: { name: string; species: Species; record_number: string | null };
  }>) {
    rows.push([
      e.animals.record_number,
      e.animals.name,
      SPECIES_LABEL[e.animals.species] ?? e.animals.species,
      ANIMAL_EXIT_TYPE_LABEL[e.kind],
      e.occurred_on,
      "",
      "",
    ]);
  }
  rows.sort((a, b) => String(b[4] ?? "").localeCompare(String(a[4] ?? "")));
  return {
    headers: [
      "Číslo záznamu",
      "Jméno",
      "Druh",
      "Způsob výdeje",
      "Datum",
      "Adoptant",
      "Poplatek (Kč)",
    ],
    rows,
  };
}

// ---- Úniky -----------------------------------------------------------------
async function escapes(s: Service, inst: string, range: Range): Promise<ReportData> {
  let q = s
    .from("animal_incidents")
    .select(
      "occurred_on, resolved_on, location, description, resolution, reported_to, animals!inner(name, species, record_number)",
    )
    .eq("institution_id", inst)
    .eq("kind", "escape")
    .order("occurred_on", { ascending: false });
  q = applyRange(q, "occurred_on", range);
  const { data } = await q;
  const rows = ((data ?? []) as Array<{
    occurred_on: string;
    resolved_on: string | null;
    location: string | null;
    description: string | null;
    resolution: string | null;
    reported_to: string | null;
    animals: { name: string; species: Species; record_number: string | null };
  }>).map((i) => [
    i.animals.record_number,
    i.animals.name,
    SPECIES_LABEL[i.animals.species] ?? i.animals.species,
    i.occurred_on,
    i.resolved_on,
    i.location,
    i.description,
    i.resolution,
    i.reported_to,
  ]);
  return {
    headers: [
      "Číslo záznamu",
      "Jméno",
      "Druh",
      "Datum úniku",
      "Vyřešeno dne",
      "Místo",
      "Popis",
      "Řešení",
      "Nahlášeno",
    ],
    rows,
  };
}

// ---- Úhyny / utracení ------------------------------------------------------
async function deaths(s: Service, inst: string, range: Range): Promise<ReportData> {
  let q = s
    .from("animal_exit_records")
    .select(
      "kind, occurred_on, reason, vet, details, animals!inner(name, species, record_number)",
    )
    .eq("institution_id", inst)
    .in("kind", ["death", "euthanasia"])
    .order("occurred_on", { ascending: false });
  q = applyRange(q, "occurred_on", range);
  const { data } = await q;
  const rows = ((data ?? []) as Array<{
    kind: AnimalExitType;
    occurred_on: string;
    reason: string | null;
    vet: string | null;
    details: string | null;
    animals: { name: string; species: Species; record_number: string | null };
  }>).map((e) => [
    e.animals.record_number,
    e.animals.name,
    SPECIES_LABEL[e.animals.species] ?? e.animals.species,
    ANIMAL_EXIT_TYPE_LABEL[e.kind],
    e.occurred_on,
    e.reason,
    e.vet,
    e.details,
  ]);
  return {
    headers: [
      "Číslo záznamu",
      "Jméno",
      "Druh",
      "Typ",
      "Datum",
      "Příčina",
      "Veterinář",
      "Okolnosti",
    ],
    rows,
  };
}

// ---- Zdravotní zásahy ------------------------------------------------------
async function health(s: Service, inst: string, range: Range): Promise<ReportData> {
  let q = s
    .from("vet_records")
    .select(
      "recorded_at, category, title, notes, vet_name, animals!inner(name, species, record_number, institution_id)",
    )
    .eq("animals.institution_id", inst)
    .order("recorded_at", { ascending: false });
  q = applyRange(q, "recorded_at", range);
  const { data } = await q;
  const rows = ((data ?? []) as Array<{
    recorded_at: string;
    category: string;
    title: string;
    notes: string | null;
    vet_name: string | null;
    animals: { name: string; species: Species; record_number: string | null };
  }>).map((r) => [
    r.animals.record_number,
    r.animals.name,
    SPECIES_LABEL[r.animals.species] ?? r.animals.species,
    r.recorded_at ? r.recorded_at.slice(0, 10) : "",
    r.category,
    r.title,
    r.notes,
    r.vet_name,
  ]);
  return {
    headers: [
      "Číslo záznamu",
      "Jméno",
      "Druh",
      "Datum",
      "Kategorie",
      "Úkon",
      "Poznámka",
      "Veterinář",
    ],
    rows,
  };
}

// ---- Karanténa & očkování --------------------------------------------------
async function quarantineVacc(
  s: Service,
  inst: string,
  range: Range,
): Promise<ReportData> {
  let qQ = s
    .from("quarantine_records")
    .select(
      "kind, started_on, planned_until, ended_on, reason, animals!inner(name, species, record_number, institution_id)",
    )
    .eq("animals.institution_id", inst)
    .order("started_on", { ascending: false });
  qQ = applyRange(qQ, "started_on", range);
  const { data: qData } = await qQ;

  let vQ = s
    .from("vaccinations")
    .select(
      "vaccine, administered_at, valid_until, vet_name, animals!inner(name, species, record_number, institution_id)",
    )
    .eq("animals.institution_id", inst)
    .order("administered_at", { ascending: false });
  vQ = applyRange(vQ, "administered_at", range);
  const { data: vData } = await vQ;

  const rows: Cell[][] = [];
  for (const q of (qData ?? []) as Array<{
    kind: AnimalSupervisionStatus;
    started_on: string;
    planned_until: string | null;
    ended_on: string | null;
    reason: string | null;
    animals: { name: string; species: Species; record_number: string | null };
  }>) {
    rows.push([
      q.animals.record_number,
      q.animals.name,
      SPECIES_LABEL[q.animals.species] ?? q.animals.species,
      SUPERVISION_STATUS_LABEL[q.kind] ?? "Karanténa",
      q.started_on,
      q.ended_on ?? q.planned_until,
      "",
      q.reason,
    ]);
  }
  for (const v of (vData ?? []) as Array<{
    vaccine: string;
    administered_at: string;
    valid_until: string | null;
    vet_name: string | null;
    animals: { name: string; species: Species; record_number: string | null };
  }>) {
    rows.push([
      v.animals.record_number,
      v.animals.name,
      SPECIES_LABEL[v.animals.species] ?? v.animals.species,
      "Očkování",
      v.administered_at,
      v.valid_until,
      v.vaccine,
      v.vet_name,
    ]);
  }
  rows.sort((a, b) => String(b[4] ?? "").localeCompare(String(a[4] ?? "")));
  return {
    headers: [
      "Číslo záznamu",
      "Jméno",
      "Druh",
      "Typ",
      "Od / podáno",
      "Do / platnost",
      "Vakcína",
      "Poznámka / veterinář",
    ],
    rows,
  };
}

// ---- Pěstounská péče -------------------------------------------------------
async function foster(s: Service, inst: string, range: Range): Promise<ReportData> {
  let q = s
    .from("foster_placements")
    .select(
      "started_on, planned_until, ended_on, end_reason, fee, animals!inner(name, record_number), foster_carers(name, city)",
    )
    .eq("institution_id", inst)
    .order("started_on", { ascending: false });
  q = applyRange(q, "started_on", range);
  const { data } = await q;
  const rows = ((data ?? []) as Array<{
    started_on: string;
    planned_until: string | null;
    ended_on: string | null;
    end_reason: string | null;
    fee: number | null;
    animals: { name: string; record_number: string | null };
    foster_carers: { name: string; city: string | null } | null;
  }>).map((p) => [
    p.animals.record_number,
    p.animals.name,
    p.foster_carers?.name ?? "—",
    p.foster_carers?.city ?? "",
    p.started_on,
    p.ended_on ?? p.planned_until,
    p.ended_on ? p.end_reason || "Ukončeno" : "Probíhá",
    p.fee,
  ]);
  return {
    headers: [
      "Číslo záznamu",
      "Zvíře",
      "Pěstoun",
      "Město",
      "Od",
      "Do / plán",
      "Výsledek",
      "Odměna (Kč)",
    ],
    rows,
  };
}

// ---- Účetní export (náklady + příjmy + dary) -------------------------------
async function accounting(
  s: Service,
  inst: string,
  range: Range,
): Promise<ReportData> {
  let costQ = s
    .from("animal_costs")
    .select("category, amount, spent_on, description, animals(name, record_number)")
    .eq("institution_id", inst);
  costQ = applyRange(costQ, "spent_on", range);
  const { data: costData } = await costQ;

  let donQ = s
    .from("animal_donations")
    .select("amount, item, donor, occurred_on, note, animals(name, record_number)")
    .eq("institution_id", inst)
    .not("amount", "is", null);
  donQ = applyRange(donQ, "occurred_on", range);
  const { data: donData } = await donQ;

  let adQ = s
    .from("adoptions")
    .select("finalized_on, fee, adopter_name, animals!inner(name, record_number)")
    .eq("institution_id", inst)
    .eq("stage", "finalized")
    .not("fee", "is", null);
  adQ = applyRange(adQ, "finalized_on", range);
  const { data: adData } = await adQ;

  const rows: Cell[][] = [];
  for (const c of (costData ?? []) as Array<{
    category: AnimalCostCategory;
    amount: number;
    spent_on: string;
    description: string | null;
    animals: { name: string; record_number: string | null } | null;
  }>) {
    rows.push([
      c.spent_on,
      "Výdaj",
      ANIMAL_COST_CATEGORY_LABEL[c.category],
      -Math.abs(c.amount),
      c.animals?.name ?? "",
      c.description,
    ]);
  }
  for (const d of (donData ?? []) as Array<{
    amount: number | null;
    donor: string | null;
    occurred_on: string;
    note: string | null;
    animals: { name: string; record_number: string | null } | null;
  }>) {
    rows.push([
      d.occurred_on,
      "Dar",
      d.donor ?? "Dar",
      d.amount ?? 0,
      d.animals?.name ?? "",
      d.note,
    ]);
  }
  for (const a of (adData ?? []) as Array<{
    finalized_on: string | null;
    fee: number | null;
    adopter_name: string;
    animals: { name: string; record_number: string | null };
  }>) {
    rows.push([
      a.finalized_on ?? "",
      "Příjem",
      "Adopční poplatek",
      a.fee ?? 0,
      a.animals.name,
      a.adopter_name,
    ]);
  }
  rows.sort((x, y) => String(y[0] ?? "").localeCompare(String(x[0] ?? "")));
  return {
    headers: ["Datum", "Typ", "Kategorie", "Částka (Kč)", "Zvíře", "Popis"],
    rows,
  };
}

/** Aplikuje uloženou šablonu sloupců (podmnožina + pořadí dle hlaviček). */
export function applyColumnTemplate(data: ReportData, columns: string[] | null): ReportData {
  if (!columns || columns.length === 0) return data;
  const idx = columns
    .map((c) => data.headers.indexOf(c))
    .filter((i) => i >= 0);
  if (idx.length === 0) return data;
  return {
    headers: idx.map((i) => data.headers[i]),
    rows: data.rows.map((r) => idx.map((i) => r[i])),
  };
}
