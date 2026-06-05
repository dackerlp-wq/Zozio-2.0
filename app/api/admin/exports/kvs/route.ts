import { type NextRequest } from "next/server";

import { getCurrentMembership } from "@/lib/auth";
import { applyColumnTemplate, buildReport, type Range } from "@/lib/exports/reports";
import { logExport, pdfResponse, periodLabel } from "@/lib/exports/helpers";
import { renderKvsEvidence } from "@/lib/pdf/kvs-evidence";
import { createServiceClient } from "@/lib/supabase/service";
import type { InstitutionRow } from "@/types/database";

export const dynamic = "force-dynamic";

// KVS evidenční kniha — dostupná i ve Free (compliance).
const KVS_COLUMNS = [
  "Číslo záznamu",
  "Jméno",
  "Druh",
  "Způsob příjmu",
  "Datum příjmu",
  "Právní stav",
  "Stav",
];

export async function GET(request: NextRequest) {
  const membership = await getCurrentMembership();
  if (!membership) {
    return Response.json({ error: "Neautorizováno." }, { status: 401 });
  }
  const { institutionId, user } = membership;
  const range: Range = {
    from: request.nextUrl.searchParams.get("from") || null,
    to: request.nextUrl.searchParams.get("to") || null,
  };

  const service = createServiceClient();
  const { data: instData } = await service
    .from("institutions")
    .select("name, legal_name, ico, address, city")
    .eq("id", institutionId)
    .maybeSingle();
  const inst = instData as Pick<
    InstitutionRow,
    "name" | "legal_name" | "ico" | "address" | "city"
  > | null;

  const full = await buildReport(service, institutionId, "intake", range);
  const data = applyColumnTemplate(full, KVS_COLUMNS);

  const generatedLabel = new Date().toLocaleDateString("cs-CZ");
  const buf = await renderKvsEvidence({
    institution: {
      name: inst?.name ?? "Útulek",
      legalName: inst?.legal_name ?? null,
      ico: inst?.ico ?? null,
      address: [inst?.address, inst?.city].filter(Boolean).join(", ") || null,
    },
    periodLabel: periodLabel(range),
    generatedLabel,
    headers: data.headers,
    rows: data.rows,
    widths: [1.2, 1.4, 1, 1.2, 1.1, 1.3, 1.1],
  });

  await logExport(service, {
    institutionId,
    kind: "kvs",
    format: "pdf",
    label: "Evidence pro KVS (PDF)",
    range,
    createdBy: user.id,
  });

  const suffix = new Date().toISOString().slice(0, 10);
  return pdfResponse(`evidence-kvs-${suffix}.pdf`, buf);
}
