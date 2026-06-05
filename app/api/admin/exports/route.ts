import { type NextRequest } from "next/server";

import { getCurrentMembership } from "@/lib/auth";
import { buildCsv, csvResponse } from "@/lib/csv";
import {
  applyColumnTemplate,
  buildReport,
  reportDef,
  type Range,
  type ReportKey,
} from "@/lib/exports/reports";
import { buildXlsx, xlsxResponse } from "@/lib/exports/xlsx";
import { HISTORY_FIELD_LABEL } from "@/lib/animal-history";
import { ADOPTION_STATUS_LABEL } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";
import type { AdoptionStatus } from "@/types/database";

export const dynamic = "force-dynamic";

type Service = ReturnType<typeof createServiceClient>;

export async function GET(request: NextRequest) {
  const membership = await getCurrentMembership();
  if (!membership) {
    return Response.json({ error: "Neautorizováno." }, { status: 401 });
  }
  const { institutionId, user } = membership;

  const params = request.nextUrl.searchParams;
  const type = params.get("type");
  const format = params.get("format") === "xlsx" ? "xlsx" : "csv";
  const preview = params.get("preview") === "1";
  const range: Range = {
    from: params.get("from") || null,
    to: params.get("to") || null,
  };

  const service = createServiceClient();
  const suffix = new Date().toISOString().slice(0, 10);

  // Per-zvíře historie změn (jiný datový zdroj, zůstává CSV).
  if (type === "animal_history") {
    const animalId = params.get("id");
    if (!animalId) {
      return Response.json({ error: "Chybí id zvířete." }, { status: 400 });
    }
    const { data: owned } = await service
      .from("animals")
      .select("id")
      .eq("id", animalId)
      .eq("institution_id", institutionId)
      .maybeSingle();
    if (!owned) {
      return Response.json({ error: "Zvíře nenalezeno." }, { status: 404 });
    }
    const csv = await animalHistoryCsv(service, animalId, range);
    return csvResponse(`historie-zmen-${suffix}.csv`, csv);
  }

  const def = reportDef(type as ReportKey);
  if (!def) {
    return Response.json({ error: "Neznámý typ exportu." }, { status: 400 });
  }

  let data = await buildReport(service, institutionId, def.key, range);

  // Uložená šablona sloupců (podmnožina + pořadí).
  const tplId = params.get("template");
  if (tplId) {
    const { data: tpl } = await service
      .from("export_column_templates")
      .select("columns")
      .eq("id", tplId)
      .eq("institution_id", institutionId)
      .maybeSingle();
    if (tpl) data = applyColumnTemplate(data, (tpl as { columns: string[] }).columns);
  }

  // Náhled = pár řádků bez stažení (kontrola rozsahu).
  if (preview) {
    return Response.json({
      headers: data.headers,
      rows: data.rows.slice(0, 5),
      total: data.rows.length,
    });
  }

  // Zápis do historie odevzdání.
  await service.from("export_log").insert({
    institution_id: institutionId,
    kind: def.key,
    format,
    label: def.label,
    period_from: range.from,
    period_to: range.to,
    created_by: user.id,
  });

  if (format === "xlsx") {
    const buf = await buildXlsx([
      { name: def.label, headers: data.headers, rows: data.rows },
    ]);
    return xlsxResponse(`${def.filename}-${suffix}.xlsx`, buf);
  }
  const csv = buildCsv(data.headers, data.rows);
  return csvResponse(`${def.filename}-${suffix}.csv`, csv);
}

/** Vyřeší jména autorů změn (auth.users → jméno/e-mail). */
async function resolveActorNames(
  service: Service,
  ids: string[],
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  await Promise.all(
    [...new Set(ids)].map(async (uid) => {
      const { data } = await service.auth.admin.getUserById(uid);
      const name =
        (data?.user?.user_metadata?.full_name as string | undefined) ||
        (data?.user?.user_metadata?.name as string | undefined) ||
        data?.user?.email ||
        null;
      if (name) names.set(uid, name);
    }),
  );
  return names;
}

// ---- Historie změn jednoho zvířete -----------------------------------------
async function animalHistoryCsv(
  service: Service,
  animalId: string,
  range: Range,
): Promise<string> {
  const toEnd = range.to ? `${range.to}T23:59:59.999Z` : null;

  let fieldQuery = service
    .from("animal_field_history")
    .select("field, old_value, new_value, changed_by, created_at")
    .eq("animal_id", animalId);
  if (range.from) fieldQuery = fieldQuery.gte("created_at", range.from);
  if (toEnd) fieldQuery = fieldQuery.lte("created_at", toEnd);
  const { data: fieldData } = await fieldQuery;

  let statusQuery = service
    .from("animal_status_events")
    .select("from_status, to_status, note, changed_by, created_at")
    .eq("animal_id", animalId);
  if (range.from) statusQuery = statusQuery.gte("created_at", range.from);
  if (toEnd) statusQuery = statusQuery.lte("created_at", toEnd);
  const { data: statusData } = await statusQuery;

  interface Entry {
    created_at: string;
    changed_by: string | null;
    field: string;
    old_value: string;
    new_value: string;
    note: string;
  }

  const entries: Entry[] = [];

  for (const f of (fieldData ?? []) as Array<{
    field: string;
    old_value: string | null;
    new_value: string | null;
    changed_by: string | null;
    created_at: string;
  }>) {
    entries.push({
      created_at: f.created_at,
      changed_by: f.changed_by,
      field: HISTORY_FIELD_LABEL[f.field] ?? f.field,
      old_value: f.old_value ?? "—",
      new_value: f.new_value ?? "—",
      note: "",
    });
  }

  for (const s of (statusData ?? []) as Array<{
    from_status: AdoptionStatus | null;
    to_status: AdoptionStatus;
    note: string | null;
    changed_by: string | null;
    created_at: string;
  }>) {
    entries.push({
      created_at: s.created_at,
      changed_by: s.changed_by,
      field: "Adopční stav",
      old_value: s.from_status ? ADOPTION_STATUS_LABEL[s.from_status] : "—",
      new_value: ADOPTION_STATUS_LABEL[s.to_status],
      note: s.note ?? "",
    });
  }

  entries.sort((a, b) => b.created_at.localeCompare(a.created_at));

  const actorNames = await resolveActorNames(
    service,
    entries.map((e) => e.changed_by).filter(Boolean) as string[],
  );

  const rows = entries.map((e) => [
    new Date(e.created_at).toLocaleString("cs-CZ"),
    e.field,
    e.old_value,
    e.new_value,
    e.changed_by ? actorNames.get(e.changed_by) ?? "" : "",
    e.note,
  ]);

  return buildCsv(
    ["Datum a čas", "Pole", "Z hodnoty", "Na hodnotu", "Kdo", "Poznámka"],
    rows,
  );
}
