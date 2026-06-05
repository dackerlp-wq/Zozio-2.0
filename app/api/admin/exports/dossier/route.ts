import { type NextRequest } from "next/server";

import { getCurrentMembership } from "@/lib/auth";
import { logExport, pdfResponse } from "@/lib/exports/helpers";
import {
  renderDocumentReport,
  type DocSection,
} from "@/lib/pdf/document-report";
import {
  ADOPTION_STATUS_LABEL,
  ANIMAL_INTAKE_TYPE_LABEL,
  ANIMAL_LEGAL_STATUS_LABEL,
  SEX_LABEL,
  SPECIES_LABEL,
  SUPERVISION_STATUS_LABEL,
} from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";
import type {
  AdoptionStatus,
  AnimalIntakeType,
  AnimalLegalStatus,
  AnimalSupervisionStatus,
  Sex,
  Species,
} from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const membership = await getCurrentMembership();
  if (!membership) {
    return Response.json({ error: "Neautorizováno." }, { status: 401 });
  }
  const { institutionId, user } = membership;
  const animalId = request.nextUrl.searchParams.get("id");
  if (!animalId) {
    return Response.json({ error: "Chybí id zvířete." }, { status: 400 });
  }

  const service = createServiceClient();
  const { data: animalData } = await service
    .from("animals")
    .select(
      "name, record_number, species, sex, chip_number, intake_type, intake_date, found_location, legal_status, protection_until, adoption_status",
    )
    .eq("id", animalId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!animalData) {
    return Response.json({ error: "Zvíře nenalezeno." }, { status: 404 });
  }
  const a = animalData as {
    name: string;
    record_number: string | null;
    species: Species;
    sex: Sex;
    chip_number: string | null;
    intake_type: AnimalIntakeType | null;
    intake_date: string | null;
    found_location: string | null;
    legal_status: AnimalLegalStatus;
    protection_until: string | null;
    adoption_status: AdoptionStatus;
  };

  const [
    { data: vaccs },
    { data: treats },
    { data: vets },
    { data: quars },
    { data: docs },
    { data: events },
  ] = await Promise.all([
    service
      .from("vaccinations")
      .select("vaccine, administered_at, valid_until")
      .eq("animal_id", animalId)
      .order("administered_at", { ascending: false }),
    service
      .from("treatments")
      .select("name, start_date, end_date")
      .eq("animal_id", animalId)
      .order("start_date", { ascending: false }),
    service
      .from("vet_records")
      .select("recorded_at, category, title")
      .eq("animal_id", animalId)
      .order("recorded_at", { ascending: false }),
    service
      .from("quarantine_records")
      .select("kind, started_on, planned_until, ended_on")
      .eq("animal_id", animalId)
      .order("started_on", { ascending: false }),
    service
      .from("animal_documents")
      .select("title, created_at")
      .eq("animal_id", animalId)
      .order("created_at", { ascending: false }),
    service
      .from("animal_status_events")
      .select("from_status, to_status, created_at")
      .eq("animal_id", animalId)
      .order("created_at", { ascending: false }),
  ]);

  const sections: DocSection[] = [
    {
      title: "Profil & příjem",
      kind: "fields",
      fields: [
        { label: "Jméno", value: a.name },
        { label: "Druh / pohlaví", value: `${SPECIES_LABEL[a.species]} · ${SEX_LABEL[a.sex]}` },
        { label: "Číslo čipu", value: a.chip_number },
        { label: "Způsob příjmu", value: a.intake_type ? ANIMAL_INTAKE_TYPE_LABEL[a.intake_type] : null },
        { label: "Datum příjmu", value: a.intake_date },
        { label: "Místo / okolnosti", value: a.found_location },
        { label: "Právní stav", value: ANIMAL_LEGAL_STATUS_LABEL[a.legal_status] },
        { label: "Konec ochranné lhůty", value: a.protection_until },
        { label: "Aktuální stav", value: ADOPTION_STATUS_LABEL[a.adoption_status] },
      ],
    },
    {
      title: "Očkování",
      kind: "table",
      headers: ["Vakcína", "Podáno", "Platnost do"],
      rows: ((vaccs ?? []) as { vaccine: string; administered_at: string; valid_until: string | null }[]).map(
        (v) => [v.vaccine, v.administered_at, v.valid_until],
      ),
    },
    {
      title: "Léčba",
      kind: "table",
      headers: ["Úkon", "Od", "Do"],
      rows: ((treats ?? []) as { name: string | null; start_date: string | null; end_date: string | null }[]).map(
        (t) => [t.name, t.start_date, t.end_date],
      ),
    },
    {
      title: "Veterinární záznamy",
      kind: "table",
      headers: ["Datum", "Kategorie", "Úkon"],
      rows: ((vets ?? []) as { recorded_at: string; category: string; title: string }[]).map((r) => [
        r.recorded_at ? r.recorded_at.slice(0, 10) : "",
        r.category,
        r.title,
      ]),
    },
    {
      title: "Karanténa & dohled",
      kind: "table",
      headers: ["Typ", "Od", "Do"],
      rows: ((quars ?? []) as {
        kind: AnimalSupervisionStatus;
        started_on: string;
        planned_until: string | null;
        ended_on: string | null;
      }[]).map((q) => [
        SUPERVISION_STATUS_LABEL[q.kind] ?? "Karanténa",
        q.started_on,
        q.ended_on ?? q.planned_until,
      ]),
    },
    {
      title: "Dokumenty",
      kind: "table",
      headers: ["Název", "Vytvořeno"],
      rows: ((docs ?? []) as { title: string; created_at: string }[]).map((d) => [
        d.title,
        d.created_at ? d.created_at.slice(0, 10) : "",
      ]),
    },
    {
      title: "Historie stavů",
      kind: "table",
      headers: ["Datum", "Z stavu", "Na stav"],
      rows: ((events ?? []) as {
        from_status: AdoptionStatus | null;
        to_status: AdoptionStatus;
        created_at: string;
      }[]).map((e) => [
        e.created_at ? e.created_at.slice(0, 10) : "",
        e.from_status ? ADOPTION_STATUS_LABEL[e.from_status] : "—",
        ADOPTION_STATUS_LABEL[e.to_status],
      ]),
    },
  ];

  const buf = await renderDocumentReport({
    title: `Dossier zvířete — ${a.name}`,
    subtitle: [a.record_number, SPECIES_LABEL[a.species]].filter(Boolean).join(" · "),
    author: "Zozio",
    generatedLabel: new Date().toLocaleDateString("cs-CZ"),
    sections,
  });

  await logExport(service, {
    institutionId,
    kind: "dossier",
    format: "pdf",
    label: `Dossier — ${a.name}`,
    createdBy: user.id,
  });

  const suffix = new Date().toISOString().slice(0, 10);
  return pdfResponse(`dossier-${a.record_number ?? animalId}-${suffix}.pdf`, buf);
}
