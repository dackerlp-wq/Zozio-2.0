"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { AnimalDocumentCategory } from "@/types/database";

type ActionResult = { error: string } | { ok: true };

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
}

export async function addDocument(
  animalId: string,
  input: DocumentInput,
): Promise<ActionResult> {
  const { ok, service, institutionId, userId } = await assertOwned(animalId);
  if (!ok) return { error: "Zvíře nepatří tvému útulku." };
  if (!input.file_path) return { error: "Nejdřív nahraj soubor." };

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
  const { ok, service } = await assertOwned(animalId);
  if (!ok) return { error: "Zvíře nepatří tvému útulku." };

  // Načti cestu + zdroj, ať můžeme smazat i soubor ze storage.
  const { data: doc } = await service
    .from("animal_documents")
    .select("file_path, file_url")
    .eq("id", documentId)
    .eq("animal_id", animalId)
    .maybeSingle();

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
