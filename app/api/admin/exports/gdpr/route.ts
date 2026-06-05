import { type NextRequest } from "next/server";

import { getCurrentMembership } from "@/lib/auth";
import { logExport, pdfResponse } from "@/lib/exports/helpers";
import {
  renderDocumentReport,
  type DocSection,
} from "@/lib/pdf/document-report";
import { APPLICATION_STATUS_LABEL } from "@/lib/format";
import { fosterTagLabelPlain } from "@/lib/foster-tags";
import { createServiceClient } from "@/lib/supabase/service";
import type { ApplicationStatus, FosterCarerRow } from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const membership = await getCurrentMembership();
  if (!membership) {
    return Response.json({ error: "Neautorizováno." }, { status: 401 });
  }
  const { institutionId, user } = membership;
  const params = request.nextUrl.searchParams;
  const kind = params.get("kind"); // foster | applicant

  const service = createServiceClient();
  const suffix = new Date().toISOString().slice(0, 10);
  const generatedLabel = new Date().toLocaleDateString("cs-CZ");

  if (kind === "foster") {
    const id = params.get("id");
    if (!id) return Response.json({ error: "Chybí id." }, { status: 400 });
    const { data: carerData } = await service
      .from("foster_carers")
      .select("*")
      .eq("id", id)
      .eq("institution_id", institutionId)
      .maybeSingle();
    if (!carerData) {
      return Response.json({ error: "Pěstoun nenalezen." }, { status: 404 });
    }
    const c = carerData as FosterCarerRow;

    const { data: placements } = await service
      .from("foster_placements")
      .select("started_on, ended_on, end_reason, animals(name)")
      .eq("carer_id", id)
      .order("started_on", { ascending: false });

    const sections: DocSection[] = [
      {
        title: "Osobní údaje (pěstoun)",
        kind: "fields",
        fields: [
          { label: "Jméno", value: c.name },
          { label: "E-mail", value: c.email },
          { label: "Telefon", value: c.phone },
          { label: "Adresa", value: [c.address, c.city, c.region].filter(Boolean).join(", ") || null },
          { label: "Kapacita", value: c.capacity != null ? String(c.capacity) : null },
          { label: "Druhy / velikosti", value: c.species_note },
          { label: "Štítky", value: (c.tags ?? []).map(fosterTagLabelPlain).join(", ") || null },
          { label: "Poznámka", value: c.notes },
        ],
      },
      {
        title: "Umístění (zpracování údajů)",
        kind: "table",
        headers: ["Zvíře", "Od", "Do", "Výsledek"],
        rows: ((placements ?? []) as {
          started_on: string;
          ended_on: string | null;
          end_reason: string | null;
          animals: { name: string } | null;
        }[]).map((p) => [p.animals?.name ?? "—", p.started_on, p.ended_on, p.end_reason]),
      },
    ];

    const buf = await renderDocumentReport({
      title: `GDPR export — ${c.name}`,
      subtitle: "Přehled osobních údajů evidovaných o subjektu (pěstoun)",
      author: "Zozio",
      generatedLabel,
      sections,
    });
    await logExport(service, {
      institutionId,
      kind: "gdpr",
      format: "pdf",
      label: `GDPR export — ${c.name}`,
      createdBy: user.id,
    });
    return pdfResponse(`gdpr-pestoun-${suffix}.pdf`, buf);
  }

  if (kind === "applicant") {
    const email = params.get("email");
    if (!email) return Response.json({ error: "Chybí e-mail." }, { status: 400 });
    const { data: apps } = await service
      .from("applications")
      .select(
        "applicant_name, applicant_email, applicant_phone, applicant_city, applicant_message, status, created_at, meeting_at, animals(name)",
      )
      .eq("institution_id", institutionId)
      .eq("applicant_email", email)
      .order("created_at", { ascending: false });
    const rows = (apps ?? []) as {
      applicant_name: string;
      applicant_email: string;
      applicant_phone: string | null;
      applicant_city: string | null;
      applicant_message: string | null;
      status: ApplicationStatus;
      created_at: string;
      meeting_at: string | null;
      animals: { name: string } | null;
    }[];
    if (rows.length === 0) {
      return Response.json({ error: "Žádné žádosti pro tento e-mail." }, { status: 404 });
    }
    const latest = rows[0];

    const sections: DocSection[] = [
      {
        title: "Osobní údaje (žadatel o adopci)",
        kind: "fields",
        fields: [
          { label: "Jméno", value: latest.applicant_name },
          { label: "E-mail", value: latest.applicant_email },
          { label: "Telefon", value: latest.applicant_phone },
          { label: "Město", value: latest.applicant_city },
        ],
      },
      {
        title: "Žádosti o adopci (zpracování údajů)",
        kind: "table",
        headers: ["Zvíře", "Stav", "Podáno", "Schůzka", "Zpráva"],
        rows: rows.map((r) => [
          r.animals?.name ?? "—",
          APPLICATION_STATUS_LABEL[r.status] ?? r.status,
          r.created_at ? r.created_at.slice(0, 10) : "",
          r.meeting_at ? r.meeting_at.slice(0, 10) : "",
          r.applicant_message,
        ]),
      },
    ];

    const buf = await renderDocumentReport({
      title: `GDPR export — ${latest.applicant_name}`,
      subtitle: "Přehled osobních údajů evidovaných o subjektu (žadatel)",
      author: "Zozio",
      generatedLabel,
      sections,
    });
    await logExport(service, {
      institutionId,
      kind: "gdpr",
      format: "pdf",
      label: `GDPR export — ${latest.applicant_name}`,
      createdBy: user.id,
    });
    return pdfResponse(`gdpr-zadatel-${suffix}.pdf`, buf);
  }

  return Response.json({ error: "Neznámý typ osoby." }, { status: 400 });
}
