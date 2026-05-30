import { type NextRequest } from "next/server";

import { getCurrentMembership } from "@/lib/auth";
import { buildCsv, csvResponse } from "@/lib/csv";
import {
  ADOPTION_STATUS_LABEL,
  ANIMAL_COST_CATEGORY_LABEL,
  ANIMAL_EXIT_TYPE_LABEL,
  ANIMAL_INCIDENT_TYPE_LABEL,
  ANIMAL_INTAKE_TYPE_LABEL,
  ANIMAL_LEGAL_STATUS_LABEL,
  SEX_LABEL,
  SPECIES_LABEL,
} from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";
import type {
  AdoptionStatus,
  AnimalCostCategory,
  AnimalExitType,
  AnimalIncidentType,
  AnimalIntakeType,
  AnimalLegalStatus,
  Sex,
  Species,
} from "@/types/database";

export const dynamic = "force-dynamic";

type ExportType =
  | "intake"
  | "output"
  | "escapes"
  | "deaths"
  | "health"
  | "capacity"
  | "costs";

const FILENAMES: Record<ExportType, string> = {
  intake: "prijata-zvirata",
  output: "vydana-zvirata",
  escapes: "uniky",
  deaths: "uhyny-utraceni",
  health: "zdravotni-zasahy",
  capacity: "kapacita",
  costs: "naklady",
};

type Service = ReturnType<typeof createServiceClient>;

interface Range {
  from: string | null;
  to: string | null;
}

export async function GET(request: NextRequest) {
  const membership = await getCurrentMembership();
  if (!membership) {
    return Response.json({ error: "Neautorizováno." }, { status: 401 });
  }
  const institutionId = membership.institutionId;

  const params = request.nextUrl.searchParams;
  const type = params.get("type") as ExportType | null;
  const range: Range = {
    from: params.get("from") || null,
    to: params.get("to") || null,
  };

  if (!type || !(type in FILENAMES)) {
    return Response.json({ error: "Neznámý typ exportu." }, { status: 400 });
  }

  const service = createServiceClient();
  let csv: string;
  switch (type) {
    case "intake":
      csv = await intakeCsv(service, institutionId, range);
      break;
    case "output":
      csv = await outputCsv(service, institutionId, range);
      break;
    case "escapes":
      csv = await escapesCsv(service, institutionId, range);
      break;
    case "deaths":
      csv = await deathsCsv(service, institutionId, range);
      break;
    case "health":
      csv = await healthCsv(service, institutionId, range);
      break;
    case "capacity":
      csv = await capacityCsv(service, institutionId);
      break;
    case "costs":
      csv = await costsCsv(service, institutionId, range);
      break;
  }

  const suffix = new Date().toISOString().slice(0, 10);
  return csvResponse(`${FILENAMES[type]}-${suffix}.csv`, csv);
}

function applyRange<T>(query: T, column: string, range: Range): T {
  // Supabase query builder je řetězitelný; typujeme volně.
  let q = query as unknown as {
    gte: (c: string, v: string) => typeof q;
    lte: (c: string, v: string) => typeof q;
  };
  if (range.from) q = q.gte(column, range.from);
  if (range.to) q = q.lte(column, range.to);
  return q as unknown as T;
}

// ---- Přijatá zvířata -------------------------------------------------------
async function intakeCsv(
  service: Service,
  institutionId: string,
  range: Range,
): Promise<string> {
  let query = service
    .from("animals")
    .select(
      "record_number, name, species, sex, intake_type, intake_date, found_date, found_location, original_owner, legal_status, protection_until, chip_number, adoption_status",
    )
    .eq("institution_id", institutionId)
    .order("intake_date", { ascending: false, nullsFirst: false });
  query = applyRange(query, "intake_date", range);
  const { data } = await query;

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

  return buildCsv(
    [
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
  );
}

// ---- Vydaná zvířata (adopce + úhyny + převody) -----------------------------
async function outputCsv(
  service: Service,
  institutionId: string,
  range: Range,
): Promise<string> {
  // Uzavřené adopce
  let adQuery = service
    .from("adoptions")
    .select(
      "finalized_on, adopter_name, fee, animals!inner(name, species, record_number)",
    )
    .eq("institution_id", institutionId)
    .eq("stage", "finalized");
  adQuery = applyRange(adQuery, "finalized_on", range);
  const { data: adData } = await adQuery;

  // Výstupní záznamy (úhyn / utracení / vrácení)
  let exQuery = service
    .from("animal_exit_records")
    .select(
      "kind, occurred_on, reason, animals!inner(name, species, record_number)",
    )
    .eq("institution_id", institutionId);
  exQuery = applyRange(exQuery, "occurred_on", range);
  const { data: exData } = await exQuery;

  const rows: (string | number | null)[][] = [];

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
    reason: string | null;
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

  return buildCsv(
    [
      "Číslo záznamu",
      "Jméno",
      "Druh",
      "Způsob výdeje",
      "Datum",
      "Adoptant",
      "Poplatek (Kč)",
    ],
    rows,
  );
}

// ---- Úniky -----------------------------------------------------------------
async function escapesCsv(
  service: Service,
  institutionId: string,
  range: Range,
): Promise<string> {
  let query = service
    .from("animal_incidents")
    .select(
      "kind, occurred_on, resolved_on, location, description, resolution, reported_to, animals!inner(name, species, record_number)",
    )
    .eq("institution_id", institutionId)
    .eq("kind", "escape")
    .order("occurred_on", { ascending: false });
  query = applyRange(query, "occurred_on", range);
  const { data } = await query;

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

  return buildCsv(
    [
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
  );
}

// ---- Úhyny / utracení ------------------------------------------------------
async function deathsCsv(
  service: Service,
  institutionId: string,
  range: Range,
): Promise<string> {
  let query = service
    .from("animal_exit_records")
    .select(
      "kind, occurred_on, reason, vet, details, animals!inner(name, species, record_number)",
    )
    .eq("institution_id", institutionId)
    .in("kind", ["death", "euthanasia"])
    .order("occurred_on", { ascending: false });
  query = applyRange(query, "occurred_on", range);
  const { data } = await query;

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

  return buildCsv(
    [
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
  );
}

// ---- Zdravotní zásahy ------------------------------------------------------
async function healthCsv(
  service: Service,
  institutionId: string,
  range: Range,
): Promise<string> {
  let query = service
    .from("vet_records")
    .select(
      "recorded_at, category, title, notes, vet_name, animals!inner(name, species, record_number, institution_id)",
    )
    .eq("animals.institution_id", institutionId)
    .order("recorded_at", { ascending: false });
  query = applyRange(query, "recorded_at", range);
  const { data } = await query;

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

  return buildCsv(
    [
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
  );
}

// ---- Kapacita (aktuální stav) ----------------------------------------------
async function capacityCsv(
  service: Service,
  institutionId: string,
): Promise<string> {
  const { data } = await service
    .from("animals")
    .select(
      "name, species, adoption_status, legal_status, supervision_status, kennels(name)",
    )
    .eq("institution_id", institutionId)
    .not("adoption_status", "in", '("adopted","transferred","deceased")')
    .order("name", { ascending: true });

  const rows = ((data ?? []) as Array<{
    name: string;
    species: Species;
    adoption_status: AdoptionStatus;
    legal_status: AnimalLegalStatus;
    kennels: { name: string } | null;
  }>).map((a) => [
    a.name,
    SPECIES_LABEL[a.species] ?? a.species,
    ADOPTION_STATUS_LABEL[a.adoption_status],
    ANIMAL_LEGAL_STATUS_LABEL[a.legal_status],
    a.kennels?.name ?? "",
  ]);

  return buildCsv(
    ["Jméno", "Druh", "Stav", "Právní stav", "Kotec"],
    rows,
  );
}

// ---- Náklady ---------------------------------------------------------------
async function costsCsv(
  service: Service,
  institutionId: string,
  range: Range,
): Promise<string> {
  let query = service
    .from("animal_costs")
    .select(
      "category, amount, spent_on, description, animals!inner(name, record_number)",
    )
    .eq("institution_id", institutionId)
    .order("spent_on", { ascending: false });
  query = applyRange(query, "spent_on", range);
  const { data } = await query;

  const rows = ((data ?? []) as Array<{
    category: AnimalCostCategory;
    amount: number;
    spent_on: string;
    description: string | null;
    animals: { name: string; record_number: string | null };
  }>).map((c) => [
    c.animals.record_number,
    c.animals.name,
    ANIMAL_COST_CATEGORY_LABEL[c.category],
    c.amount,
    c.spent_on,
    c.description,
  ]);

  return buildCsv(
    ["Číslo záznamu", "Jméno", "Kategorie", "Částka (Kč)", "Datum", "Popis"],
    rows,
  );
}
