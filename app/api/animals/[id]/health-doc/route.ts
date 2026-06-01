import { NextResponse, type NextRequest } from "next/server";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { vaccineStatus } from "@/lib/animal-health";
import { SEX_LABEL, SPECIES_LABEL, TREATMENT_TYPE_LABEL } from "@/lib/format";
import {
  renderHealthRecord,
  type HealthDocVariant,
  type HealthRecordData,
} from "@/lib/pdf/health-record";
import type {
  AnimalConditionRow,
  AnimalRow,
  TreatmentRow,
  VaccinationRow,
  VetRecordRow,
  WeightLogRow,
} from "@/types/database";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VAX_LABEL: Record<string, string> = {
  valid: "platné",
  expiring: "expiruje brzy",
  expired: "propadlé",
  unknown: "bez data",
};

function cz(iso: string | null): string | null {
  return iso ? new Date(iso + "T00:00:00").toLocaleDateString("cs-CZ") : null;
}

export async function GET(request: NextRequest, ctx: RouteParams) {
  const { id } = await ctx.params;
  const variant: HealthDocVariant =
    request.nextUrl.searchParams.get("variant") === "full" ? "full" : "owner";
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

  const [{ data: instData }, { data: vaxData }, { data: condData }, { data: weightData }] =
    await Promise.all([
      service.from("institutions").select("name").eq("id", institutionId).maybeSingle(),
      service.from("vaccinations").select("*").eq("animal_id", id).order("administered_at", { ascending: false }),
      service.from("animal_conditions").select("*").eq("animal_id", id).order("created_at", { ascending: true }),
      service.from("weight_logs").select("*").eq("animal_id", id).order("measured_at", { ascending: false }).limit(1),
    ]);

  const vaccines = ((vaxData ?? []) as VaccinationRow[]).map((v) => ({
    name: v.vaccine,
    validUntil: cz(v.valid_until),
    status: VAX_LABEL[vaccineStatus(v.valid_until)],
  }));
  const conditions = ((condData ?? []) as AnimalConditionRow[]).map((c) => c.label);
  const lastWeight = (weightData ?? [])[0] as WeightLogRow | undefined;

  // Pro variantu „full" (kontrola) dotáhni léčby, vet. záznamy a historii vážení.
  let treatments: HealthRecordData["treatments"];
  let vetRecords: HealthRecordData["vetRecords"];
  let weights: HealthRecordData["weights"];
  if (variant === "full") {
    const [{ data: treatData }, { data: vetData }, { data: allWeights }] =
      await Promise.all([
        service.from("treatments").select("*").eq("animal_id", id).order("start_date", { ascending: false, nullsFirst: false }),
        service.from("vet_records").select("*").eq("animal_id", id).order("recorded_at", { ascending: false }),
        service.from("weight_logs").select("*").eq("animal_id", id).order("measured_at", { ascending: false }),
      ]);
    treatments = ((treatData ?? []) as TreatmentRow[]).map((t) => ({
      name: t.name,
      type: TREATMENT_TYPE_LABEL[t.type],
      period: [cz(t.start_date), cz(t.end_date)].filter(Boolean).join(" – "),
      vet: t.vet_name,
      notes: t.notes,
    }));
    vetRecords = ((vetData ?? []) as VetRecordRow[]).map((r) => ({
      title: r.title,
      date: cz(r.recorded_at) ?? "",
      vet: r.vet_name,
      notes: r.notes,
    }));
    weights = ((allWeights ?? []) as WeightLogRow[]).map((w) => ({
      weight: `${w.weight_kg} kg`,
      date: cz(w.measured_at) ?? "",
    }));
  }

  const pdf = await renderHealthRecord({
    variant,
    dateLabel: new Date().toLocaleDateString("cs-CZ"),
    institution: { name: (instData as { name: string } | null)?.name ?? "Útulek" },
    animal: {
      name: a.name,
      species: SPECIES_LABEL[a.species] ?? a.species,
      breed: [a.breed, a.is_crossbreed ? "(kříženec)" : "", a.breed_secondary]
        .filter(Boolean)
        .join(" "),
      sex: a.sex !== "unknown" ? SEX_LABEL[a.sex] : null,
      chip: a.chip_number,
      neutered: a.is_neutered == null ? null : a.is_neutered ? "Ano" : "Ne",
      lastWeight: lastWeight ? `${lastWeight.weight_kg} kg (${cz(lastWeight.measured_at)})` : null,
    },
    vaccines,
    conditions,
    treatments,
    vetRecords,
    weights,
  });

  const suffix = variant === "full" ? "kompletni" : "majitel";
  const filename = `zdravotni-karta-${suffix}-${(a.record_number ?? id).replace(/\//g, "-")}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
