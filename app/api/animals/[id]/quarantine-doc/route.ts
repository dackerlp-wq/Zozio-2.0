import { NextResponse, type NextRequest } from "next/server";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { episodeDay } from "@/lib/animal-quarantine";
import { SUPERVISION_STATUS_LABEL } from "@/lib/format";
import { renderQuarantineRecord } from "@/lib/pdf/quarantine-record";
import type {
  AnimalRow,
  QuarantineObservationRow,
  QuarantineRecordRow,
} from "@/types/database";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function cz(iso: string | null): string | null {
  return iso ? new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleString("cs-CZ") : null;
}
function czDate(iso: string | null): string | null {
  return iso ? new Date(iso + "T00:00:00").toLocaleDateString("cs-CZ") : null;
}

export async function GET(_request: NextRequest, ctx: RouteParams) {
  const { id } = await ctx.params;
  const { institutionId } = await requireMembership();
  const service = createServiceClient();

  const { data: animalData } = await service
    .from("animals")
    .select("id, name, record_number, institution_id")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!animalData) {
    return NextResponse.json({ error: "Zvíře nenalezeno." }, { status: 404 });
  }
  const a = animalData as Pick<AnimalRow, "id" | "name" | "record_number">;

  const { data: epData } = await service
    .from("quarantine_records")
    .select("*")
    .eq("animal_id", id)
    .order("started_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!epData) {
    return NextResponse.json({ error: "Žádná epizoda dohledu." }, { status: 404 });
  }
  const ep = epData as QuarantineRecordRow;

  const { data: instData } = await service
    .from("institutions")
    .select("name")
    .eq("id", institutionId)
    .maybeSingle();

  const { data: obsData } = await service
    .from("quarantine_observations")
    .select("*")
    .eq("animal_id", id)
    .eq("quarantine_id", ep.id)
    .order("observed_at", { ascending: false });
  const observations = ((obsData ?? []) as QuarantineObservationRow[]).map((o) => ({
    date: cz(o.observed_at) ?? "",
    temp: o.temperature != null ? `${o.temperature} °C` : null,
    flag: o.flag,
    note: o.note,
  }));

  const pdf = await renderQuarantineRecord({
    dateLabel: new Date().toLocaleDateString("cs-CZ"),
    institution: { name: (instData as { name: string } | null)?.name ?? "Útulek" },
    animal: { name: a.name },
    episode: {
      kindLabel: SUPERVISION_STATUS_LABEL[ep.kind],
      reason: ep.reason,
      started: czDate(ep.started_on) ?? "",
      plannedUntil: czDate(ep.planned_until),
      ended: czDate(ep.ended_on),
      dayCount: episodeDay(ep.started_on),
    },
    observations,
  });

  const filename = `prubeh-dohledu-${(a.record_number ?? id).replace(/\//g, "-")}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
