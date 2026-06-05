import { type NextRequest } from "next/server";

import { getCurrentMembership } from "@/lib/auth";
import { logExport, pdfResponse, periodLabel } from "@/lib/exports/helpers";
import type { Range } from "@/lib/exports/reports";
import { renderAnnualReport } from "@/lib/pdf/annual-report";
import { createServiceClient } from "@/lib/supabase/service";
import type { InstitutionRow } from "@/types/database";

export const dynamic = "force-dynamic";

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

async function countRange(
  service: Service,
  table: string,
  instCol: string,
  institutionId: string,
  dateCol: string,
  range: Range,
  extra?: (q: unknown) => unknown,
): Promise<number> {
  let q = service
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(instCol, institutionId);
  if (extra) q = extra(q) as typeof q;
  q = applyRange(q, dateCol, range);
  const { count } = await q;
  return count ?? 0;
}

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
    .select("name, ico")
    .eq("id", institutionId)
    .maybeSingle();
  const inst = instData as Pick<InstitutionRow, "name" | "ico"> | null;

  // Příjmy
  const intakeCount = await countRange(
    service,
    "animals",
    "institution_id",
    institutionId,
    "intake_date",
    range,
  );

  // Adopce (finalizované) + poplatky + průměrná délka pobytu
  let adQ = service
    .from("adoptions")
    .select("finalized_on, fee, animals!inner(intake_date)")
    .eq("institution_id", institutionId)
    .eq("stage", "finalized");
  adQ = applyRange(adQ, "finalized_on", range);
  const { data: adData } = await adQ;
  const adoptions = (adData ?? []) as Array<{
    finalized_on: string | null;
    fee: number | null;
    animals: { intake_date: string | null };
  }>;
  const adoptionCount = adoptions.length;
  const feeSum = adoptions.reduce((s, a) => s + (a.fee ?? 0), 0);
  const stays = adoptions
    .map((a) =>
      a.finalized_on && a.animals.intake_date
        ? Math.round(
            (new Date(a.finalized_on).getTime() -
              new Date(a.animals.intake_date).getTime()) /
              86_400_000,
          )
        : null,
    )
    .filter((d): d is number => d != null && d >= 0);
  const avgStay = stays.length
    ? Math.round(stays.reduce((s, d) => s + d, 0) / stays.length)
    : null;

  // Úhyny / utracení a vrácení
  const deathCount = await countRange(
    service,
    "animal_exit_records",
    "institution_id",
    institutionId,
    "occurred_on",
    range,
    (q) => (q as { in: (c: string, v: string[]) => unknown }).in("kind", ["death", "euthanasia"]),
  );
  const returnCount = await countRange(
    service,
    "animal_exit_records",
    "institution_id",
    institutionId,
    "occurred_on",
    range,
    (q) => (q as { eq: (c: string, v: string) => unknown }).eq("kind", "return"),
  );

  // Náklady + dary
  let costQ = service
    .from("animal_costs")
    .select("amount")
    .eq("institution_id", institutionId);
  costQ = applyRange(costQ, "spent_on", range);
  const { data: costData } = await costQ;
  const costsSum = ((costData ?? []) as { amount: number }[]).reduce(
    (s, c) => s + (c.amount ?? 0),
    0,
  );

  let donQ = service
    .from("animal_donations")
    .select("amount")
    .eq("institution_id", institutionId)
    .not("amount", "is", null);
  donQ = applyRange(donQ, "occurred_on", range);
  const { data: donData } = await donQ;
  const donationsSum = ((donData ?? []) as { amount: number | null }[]).reduce(
    (s, d) => s + (d.amount ?? 0),
    0,
  );

  const outcomes = adoptionCount + deathCount + returnCount;
  const successRate = outcomes > 0 ? Math.round((adoptionCount / outcomes) * 100) : null;
  const czk = (n: number) => `${n.toLocaleString("cs-CZ")} Kč`;

  const buf = await renderAnnualReport({
    institution: { name: inst?.name ?? "Útulek", ico: inst?.ico ?? null },
    periodLabel: periodLabel(range),
    generatedLabel: new Date().toLocaleDateString("cs-CZ"),
    stats: [
      { value: String(intakeCount), label: "Přijatých zvířat" },
      { value: String(adoptionCount), label: "Adopcí" },
      { value: successRate != null ? `${successRate} %` : "—", label: "Úspěšnost adopcí" },
      { value: avgStay != null ? `${avgStay} dní` : "—", label: "Průměrná délka pobytu" },
      { value: czk(costsSum), label: "Náklady" },
      { value: czk(donationsSum + feeSum), label: "Příjmy (dary + poplatky)" },
    ],
    details: [
      { label: "Úhyny a utracení", value: String(deathCount) },
      { label: "Vrácení", value: String(returnCount) },
      { label: "Adopční poplatky celkem", value: czk(feeSum) },
      { label: "Dary celkem", value: czk(donationsSum) },
    ],
  });

  await logExport(service, {
    institutionId,
    kind: "annual",
    format: "pdf",
    label: "Výroční zpráva (PDF)",
    range,
    createdBy: user.id,
  });

  const suffix = new Date().toISOString().slice(0, 10);
  return pdfResponse(`vyrocni-zprava-${suffix}.pdf`, buf);
}
