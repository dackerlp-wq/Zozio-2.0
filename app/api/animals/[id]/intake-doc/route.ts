import { NextResponse, type NextRequest } from "next/server";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import {
  ANIMAL_INTAKE_TYPE_LABEL,
  ANIMAL_LEGAL_STATUS_LABEL,
  CHIP_CHECK_RESULT_LABEL,
  SEX_LABEL,
  SPECIES_LABEL,
  VET_CARE_NEED_LABEL,
} from "@/lib/format";
import { renderIntakeRecord } from "@/lib/pdf/intake-record";
import type { AnimalRow, InstitutionRow } from "@/types/database";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

function cz(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("cs-CZ");
}

export async function GET(_request: NextRequest, ctx: RouteParams) {
  const { id } = await ctx.params;
  const { institutionId } = await requireMembership();
  const service = createServiceClient();

  const { data: animalData } = await service
    .from("animals")
    .select("*")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!animalData) {
    return NextResponse.json({ error: "Zvíře nenalezeno." }, { status: 404 });
  }
  const a = animalData as AnimalRow;

  const { data: instData } = await service
    .from("institutions")
    .select("name, legal_name, ico, address, city, email, phone")
    .eq("id", institutionId)
    .maybeSingle();
  const inst = (instData ?? {}) as Partial<InstitutionRow>;

  // Identifikace
  const idParts: string[] = [];
  if (a.chip_number) idParts.push(`čip ${a.chip_number}`);
  if (a.tattoo) idParts.push(`tetování ${a.tattoo}`);
  if (a.ear_tag) idParts.push(`známka ${a.ear_tag}`);
  const identification = a.identification_none
    ? "Bez identifikace (vědomě potvrzeno)"
    : idParts.join(" · ") || "—";

  // Zdroj dle způsobu příjmu
  let sourceLabel: string | null = null;
  let sourceValue: string | null = null;
  if (a.intake_type === "found") {
    sourceLabel = "Nálezce";
    sourceValue =
      [a.handed_over_by, a.handed_over_phone, a.handed_over_email]
        .filter(Boolean)
        .join(" · ") || null;
  } else if (a.intake_type === "surrender") {
    sourceLabel = "Původní majitel";
    sourceValue = a.original_owner ?? null;
  } else if (a.intake_type === "transfer") {
    sourceLabel = "Zdrojová instituce";
    sourceValue = a.source_institution ?? null;
  } else if (a.intake_type === "confiscation") {
    sourceLabel = "Orgán / č. rozhodnutí";
    sourceValue =
      [a.confiscation_authority, a.confiscation_ref].filter(Boolean).join(" · ") ||
      null;
  }

  const chipCheck = a.chip_check_result
    ? `${CHIP_CHECK_RESULT_LABEL[a.chip_check_result]}${a.chip_checked_at ? ` (${cz(a.chip_checked_at)})` : ""}`
    : null;

  const pdf = await renderIntakeRecord({
    recordNumber: a.record_number ?? "—",
    dateLabel: new Date().toLocaleDateString("cs-CZ"),
    institution: {
      name: inst.legal_name?.trim() || inst.name || "Útulek",
      address: [inst.address, inst.city].filter(Boolean).join(", ") || null,
      ico: inst.ico ?? null,
      email: inst.email ?? null,
      phone: inst.phone ?? null,
    },
    animal: {
      name: a.name,
      species: SPECIES_LABEL[a.species] ?? a.species,
      breed: [a.breed, a.is_crossbreed ? "(kříženec)" : "", a.breed_secondary]
        .filter(Boolean)
        .join(" "),
      sex: a.sex !== "unknown" ? SEX_LABEL[a.sex] : null,
      color: a.color,
      chip: a.chip_number,
    },
    intake: {
      typeLabel: a.intake_type ? ANIMAL_INTAKE_TYPE_LABEL[a.intake_type] : "—",
      dateLabel: cz(a.intake_date),
      foundDate: cz(a.found_date),
      foundLocation: a.found_location,
      legalStatusLabel: ANIMAL_LEGAL_STATUS_LABEL[a.legal_status],
      protectionUntil: cz(a.protection_until),
      identification,
      chipCheck,
      vetCare: a.vet_care_need ? VET_CARE_NEED_LABEL[a.vet_care_need] : null,
      staff: a.intake_staff,
      staffRole: a.intake_staff_role,
      sourceLabel,
      sourceValue,
      kvsReportedAt: cz(a.kvs_reported_at),
    },
  });

  const filename = `doklad-prijmu-${(a.record_number ?? id).replace(/\//g, "-")}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
