import { type NextRequest } from "next/server";
import JSZip from "jszip";

import { getCurrentMembership } from "@/lib/auth";
import { buildCsv } from "@/lib/csv";
import { logExport } from "@/lib/exports/helpers";
import { buildReport, REPORT_DEFS, type Range } from "@/lib/exports/reports";
import { buildXlsx } from "@/lib/exports/xlsx";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const membership = await getCurrentMembership();
  if (!membership) {
    return Response.json({ error: "Neautorizováno." }, { status: 401 });
  }
  const { institutionId, user } = membership;

  const service = createServiceClient();
  const { data: inst } = await service
    .from("institutions")
    .select("plan")
    .eq("id", institutionId)
    .maybeSingle();
  const plan = (inst as { plan: string } | null)?.plan ?? "free";
  if (plan === "free") {
    return Response.json(
      { error: "Dávkový ZIP export je dostupný jen v placených tarifech." },
      { status: 403 },
    );
  }

  const format = request.nextUrl.searchParams.get("format") === "xlsx" ? "xlsx" : "csv";
  const range: Range = {
    from: request.nextUrl.searchParams.get("from") || null,
    to: request.nextUrl.searchParams.get("to") || null,
  };

  const zip = new JSZip();
  for (const def of REPORT_DEFS) {
    const data = await buildReport(service, institutionId, def.key, range);
    if (format === "xlsx") {
      const buf = await buildXlsx([
        { name: def.label, headers: data.headers, rows: data.rows },
      ]);
      zip.file(`${def.filename}.xlsx`, buf);
    } else {
      zip.file(`${def.filename}.csv`, buildCsv(data.headers, data.rows));
    }
  }

  const content = await zip.generateAsync({ type: "uint8array" });

  await logExport(service, {
    institutionId,
    kind: "zip",
    format: "zip",
    label: "Stáhnout vše (ZIP)",
    range,
    createdBy: user.id,
  });

  const suffix = new Date().toISOString().slice(0, 10);
  return new Response(content as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="evidence-vse-${suffix}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
