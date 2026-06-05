import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type { Range } from "@/lib/exports/reports";

type Service = ReturnType<typeof createServiceClient>;

export function periodLabel(range: Range): string {
  if (range.from && range.to) return `${range.from} – ${range.to}`;
  if (range.from) return `od ${range.from}`;
  if (range.to) return `do ${range.to}`;
  return "celá historie";
}

export function pdfResponse(filename: string, buf: Buffer): Response {
  return new Response(buf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Zapíše záznam do historie odevzdání. */
export async function logExport(
  service: Service,
  args: {
    institutionId: string;
    kind: string;
    format: string;
    label: string;
    range?: Range;
    createdBy?: string | null;
  },
): Promise<void> {
  await service.from("export_log").insert({
    institution_id: args.institutionId,
    kind: args.kind,
    format: args.format,
    label: args.label,
    period_from: args.range?.from ?? null,
    period_to: args.range?.to ?? null,
    created_by: args.createdBy ?? null,
  });
}
