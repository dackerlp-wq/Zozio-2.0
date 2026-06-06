"use server";

import { revalidatePath } from "next/cache";

import { requireMembership, ensurePermission } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { autoDocName } from "@/lib/animal-documents";
import { SEX_LABEL, SPECIES_LABEL } from "@/lib/format";
import { renderIntakeRecord } from "@/lib/pdf/intake-record";
import { renderAdoptionContract } from "@/lib/pdf/adoption-contract";
import type {
  AdoptionRow,
  AnimalDocumentCategory,
  AnimalDocumentSource,
  AnimalRow,
  InstitutionRow,
} from "@/types/database";

type ActionResult = { error: string } | { ok: true };
const DOCUMENTS_BUCKET = "animal-documents";

function cz(iso: string | null): string | null {
  return iso ? new Date(iso).toLocaleDateString("cs-CZ") : null;
}

/** Ověří, že zvíře patří útulku přihlášeného uživatele. */
async function assertOwned(animalId: string) {
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();
  const { data } = await service
    .from("animals")
    .select("id")
    .eq("id", animalId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  return { ok: Boolean(data), service, institutionId, userId: user.id };
}

export interface DocumentInput {
  category: AnimalDocumentCategory;
  title: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  document_date: string;
  notes: string;
  source?: AnimalDocumentSource;
  expires_on?: string;
  /** Nová verze nahrazující tento dokument (zůstává v historii). */
  supersedes_id?: string;
}

export async function addDocument(
  animalId: string,
  input: DocumentInput,
): Promise<ActionResult> {
  const __perm = await ensurePermission("animals_edit");
  if (!__perm.ok) return { error: __perm.error };
  const { ok, service, institutionId, userId } = await assertOwned(animalId);
  if (!ok) return { error: "Zvíře nepatří tvému útulku." };
  if (!input.file_path) return { error: "Nejdřív nahraj soubor." };

  // Verzování: nová verze přebírá kategorii a zvyšuje číslo verze.
  let version = 1;
  if (input.supersedes_id) {
    const { data: prev } = await service
      .from("animal_documents")
      .select("version")
      .eq("id", input.supersedes_id)
      .eq("animal_id", animalId)
      .maybeSingle();
    version = ((prev as { version: number } | null)?.version ?? 1) + 1;
  }

  const { error } = await service.from("animal_documents").insert({
    animal_id: animalId,
    institution_id: institutionId,
    category: input.category,
    title: input.title.trim() || input.file_name || "Dokument",
    file_url: null,
    file_path: input.file_path,
    file_name: input.file_name || null,
    file_size: input.file_size || null,
    mime_type: input.mime_type || null,
    document_date: input.document_date || null,
    notes: input.notes.trim() || null,
    source: input.source ?? "upload",
    expires_on: input.expires_on || null,
    version,
    supersedes_id: input.supersedes_id || null,
    uploaded_by: userId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/animals/${animalId}/dokumenty`);
  return { ok: true };
}

/**
 * Vygeneruje PDF (příjmový doklad / smlouvy) přes PDF modul, uloží do storage
 * a zapíše dokument se zdrojem `generated`. Auto-generované dokumenty se
 * nemažou ručně — re-generují se u zdroje.
 */
export async function generateDocument(
  animalId: string,
  kind: "intake" | "adoption",
): Promise<ActionResult> {
  const __perm = await ensurePermission("animals_edit");
  if (!__perm.ok) return { error: __perm.error };
  const { ok, service, institutionId, userId } = await assertOwned(animalId);
  if (!ok) return { error: "Zvíře nepatří tvému útulku." };

  const { data: animalData } = await service
    .from("animals")
    .select("*")
    .eq("id", animalId)
    .maybeSingle();
  if (!animalData) return { error: "Zvíře nenalezeno." };
  const a = animalData as AnimalRow;

  const { data: instData } = await service
    .from("institutions")
    .select("name, legal_name, ico, address, city, email, phone")
    .eq("id", institutionId)
    .maybeSingle();
  const inst = (instData ?? {}) as Partial<InstitutionRow>;

  const institution = {
    name: inst.legal_name?.trim() || inst.name || "Útulek",
    address: [inst.address, inst.city].filter(Boolean).join(", ") || null,
    ico: inst.ico ?? null,
    email: inst.email ?? null,
    phone: inst.phone ?? null,
  };
  const breed = [a.breed, a.is_crossbreed ? "(kříženec)" : "", a.breed_secondary]
    .filter(Boolean)
    .join(" ");

  let pdf: Buffer;
  let category: AnimalDocumentCategory;
  let title: string;

  if (kind === "intake") {
    pdf = await renderIntakeRecord({
      recordNumber: a.record_number ?? "—",
      dateLabel: new Date().toLocaleDateString("cs-CZ"),
      institution,
      animal: {
        name: a.name,
        species: SPECIES_LABEL[a.species] ?? a.species,
        breed,
        sex: a.sex !== "unknown" ? SEX_LABEL[a.sex] : null,
        color: a.color,
        chip: a.chip_number,
      },
      intake: {
        typeLabel: a.intake_type ?? "—",
        dateLabel: cz(a.intake_date),
        foundDate: cz(a.found_date),
        foundLocation: a.found_location,
        legalStatusLabel: a.legal_status,
        protectionUntil: cz(a.protection_until),
        identification: a.chip_number ? `čip ${a.chip_number}` : "—",
        chipCheck: null,
        vetCare: null,
        staff: a.intake_staff,
        staffRole: a.intake_staff_role,
        sourceLabel: null,
        sourceValue: null,
        kvsReportedAt: cz(a.kvs_reported_at),
      },
    });
    category = "intake";
    title = "Doklad o příjmu";
  } else {
    const { data: adoptionData } = await service
      .from("adoptions")
      .select("*")
      .eq("animal_id", animalId)
      .in("stage", ["trial", "finalized"])
      .order("started_on", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!adoptionData) return { error: "Žádná adopce — smlouvu nelze vygenerovat." };
    const ad = adoptionData as AdoptionRow;
    pdf = await renderAdoptionContract({
      contractNumber: `S-${new Date().getFullYear()}-${ad.id.slice(0, 8).toUpperCase()}`,
      dateLabel: new Date().toLocaleDateString("cs-CZ"),
      institution,
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
      feeLabel: ad.fee != null && ad.fee > 0 ? `${ad.fee.toLocaleString("cs-CZ")} Kč` : "Zdarma",
    });
    category = "contract";
    title = "Adopční smlouva";
  }

  const fileName = autoDocName(a.record_number, a.name, category);
  const path = `${institutionId}/${animalId}/${Date.now()}-${fileName}`;
  const { error: upErr } = await service.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, new Uint8Array(pdf), { contentType: "application/pdf", upsert: true });
  if (upErr) return { error: upErr.message };

  const { error } = await service.from("animal_documents").insert({
    animal_id: animalId,
    institution_id: institutionId,
    category,
    title,
    file_url: null,
    file_path: path,
    file_name: fileName,
    file_size: pdf.byteLength,
    mime_type: "application/pdf",
    document_date: new Date().toISOString().slice(0, 10),
    source: "generated",
    version: 1,
    uploaded_by: userId,
  });
  if (error) return { error: error.message };

  revalidatePath(`/admin/animals/${animalId}/dokumenty`);
  return { ok: true };
}

export async function deleteDocument(
  documentId: string,
  animalId: string,
): Promise<ActionResult> {
  const __perm = await ensurePermission("animals_edit");
  if (!__perm.ok) return { error: __perm.error };
  const { ok, service } = await assertOwned(animalId);
  if (!ok) return { error: "Zvíře nepatří tvému útulku." };

  // Načti cestu + zdroj, ať můžeme smazat i soubor ze storage.
  const { data: doc } = await service
    .from("animal_documents")
    .select("file_path, file_url, source")
    .eq("id", documentId)
    .eq("animal_id", animalId)
    .maybeSingle();

  if ((doc as { source?: string } | null)?.source === "generated") {
    return { error: "Auto-generovaný dokument nelze smazat ručně — re-generuje se u zdroje." };
  }

  const { error } = await service
    .from("animal_documents")
    .delete()
    .eq("id", documentId)
    .eq("animal_id", animalId);
  if (error) return { error: error.message };

  if (doc?.file_path) {
    // Privátní dokumenty (bez file_url) jsou v bucketu animal-documents,
    // starší veřejné v bucketu animals.
    const bucket = doc.file_url ? "animals" : "animal-documents";
    await service.storage.from(bucket).remove([doc.file_path]);
  }

  revalidatePath(`/admin/animals/${animalId}/dokumenty`);
  return { ok: true };
}
