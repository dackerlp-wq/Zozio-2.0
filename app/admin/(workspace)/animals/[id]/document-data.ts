import "server-only";

import { createServiceClient } from "@/lib/supabase/service";
import type { AnimalDocumentRow } from "@/types/database";

const DOCUMENTS_BUCKET = "animal-documents";
const SIGNED_TTL = 60 * 60; // 1 hodina

export type DocumentWithUrl = AnimalDocumentRow & { signed_url: string | null };

/**
 * Doplní k dokumentům dočasnou (signed) URL pro otevření.
 * Starší veřejné dokumenty (file_url) se vrací beze změny.
 */
export async function withSignedUrls(
  rows: AnimalDocumentRow[],
): Promise<DocumentWithUrl[]> {
  if (rows.length === 0) return [];
  const service = createServiceClient();

  return Promise.all(
    rows.map(async (r) => {
      if (r.file_url) return { ...r, signed_url: r.file_url };
      const { data } = await service.storage
        .from(DOCUMENTS_BUCKET)
        .createSignedUrl(r.file_path, SIGNED_TTL);
      return { ...r, signed_url: data?.signedUrl ?? null };
    }),
  );
}
