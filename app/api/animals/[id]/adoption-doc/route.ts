import { NextResponse, type NextRequest } from "next/server";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { SEX_LABEL, SPECIES_LABEL } from "@/lib/format";
import { renderAdoptionContract } from "@/lib/pdf/adoption-contract";
import type { AdoptionRow, AnimalRow, InstitutionRow } from "@/types/database";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
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

  // Nejnovější běžící / dokončená adopce (zdroj údajů adoptanta).
  const { data: adoptionData } = await service
    .from("adoptions")
    .select("*")
    .eq("animal_id", id)
    .in("stage", ["trial", "finalized"])
    .order("started_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!adoptionData) {
    return NextResponse.json(
      { error: "Žádná běžící ani dokončená adopce — smlouvu nelze vygenerovat." },
      { status: 404 },
    );
  }
  const ad = adoptionData as AdoptionRow;

  const { data: instData } = await service
    .from("institutions")
    .select("name, legal_name, ico, address, city, email, phone")
    .eq("id", institutionId)
    .maybeSingle();
  const inst = (instData ?? {}) as Partial<InstitutionRow>;

  const breed = [a.breed, a.is_crossbreed ? "(kříženec)" : "", a.breed_secondary]
    .filter(Boolean)
    .join(" ");
  const feeLabel = ad.fee != null && ad.fee > 0 ? `${ad.fee.toLocaleString("cs-CZ")} Kč` : "Zdarma";
  const contractNumber = `S-${new Date().getFullYear()}-${ad.id.slice(0, 8).toUpperCase()}`;

  const pdf = await renderAdoptionContract({
    contractNumber,
    dateLabel: new Date().toLocaleDateString("cs-CZ"),
    institution: {
      name: inst.legal_name?.trim() || inst.name || "Útulek",
      address: [inst.address, inst.city].filter(Boolean).join(", ") || null,
      ico: inst.ico ?? null,
      email: inst.email ?? null,
      phone: inst.phone ?? null,
    },
    adopter: {
      name: ad.adopter_name,
      address: ad.adopter_address,
      email: ad.adopter_email,
      phone: ad.adopter_phone,
      idNumber: ad.adopter_id_number,
    },
    animal: {
      name: a.name,
      species: SPECIES_LABEL[a.species] ?? a.species,
      breed,
      sex: a.sex !== "unknown" ? SEX_LABEL[a.sex] : null,
      color: a.color,
      chip: a.chip_number,
      recordNumber: a.record_number,
    },
    feeLabel,
  });

  const filename = `adopcni-smlouva-${a.name.replace(/\s+/g, "-")}.pdf`;
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
