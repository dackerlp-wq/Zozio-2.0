import { NextResponse, type NextRequest } from "next/server";
import JSZip from "jszip";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { adoptionBundleName, autoDocName } from "@/lib/animal-documents";
import type { AnimalDocumentCategory, AnimalDocumentRow } from "@/types/database";

export const dynamic = "force-dynamic";

const DOCUMENTS_BUCKET = "animal-documents";

// Kategorie klíčových dokumentů do adopční složky (v pořadí do ZIPu).
const BUNDLE_CATEGORIES: AnimalDocumentCategory[] = ["contract", "vaccination", "medical", "registration"];

interface RouteParams {
  params: Promise<{ id: string }>;
}

function extFromName(name: string | null, mime: string | null): string {
  const fromName = name?.split(".").pop();
  if (fromName && fromName.length <= 5 && fromName !== name) return fromName.toLowerCase();
  if (mime?.includes("pdf")) return "pdf";
  if (mime?.startsWith("image/")) return mime.split("/")[1] ?? "img";
  return "bin";
}

export async function GET(_request: NextRequest, ctx: RouteParams) {
  const { id } = await ctx.params;
  const { institutionId } = await requireMembership();
  const service = createServiceClient();

  const { data: animalData } = await service
    .from("animals")
    .select("name, record_number")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!animalData) {
    return NextResponse.json({ error: "Zvíře nenalezeno." }, { status: 404 });
  }
  const a = animalData as { name: string; record_number: string | null };

  const { data: docsData } = await service
    .from("animal_documents")
    .select("*")
    .eq("animal_id", id)
    .eq("institution_id", institutionId)
    .in("category", BUNDLE_CATEGORIES)
    .order("version", { ascending: false })
    .order("created_at", { ascending: false });
  const docs = (docsData ?? []) as AnimalDocumentRow[];

  // Nejnovější verze každé kategorie (řazeno desc → první výskyt vyhrává).
  const newest = new Map<AnimalDocumentCategory, AnimalDocumentRow>();
  for (const d of docs) {
    if (!newest.has(d.category)) newest.set(d.category, d);
  }

  const zip = new JSZip();
  let added = 0;
  for (const category of BUNDLE_CATEGORIES) {
    const doc = newest.get(category);
    if (!doc) continue;
    const { data: file } = await service.storage.from(DOCUMENTS_BUCKET).download(doc.file_path);
    if (!file) continue;
    const buffer = await file.arrayBuffer();
    const ext = extFromName(doc.file_name, doc.mime_type);
    zip.file(autoDocName(a.record_number, a.name, category, ext), buffer);
    added += 1;
  }

  if (added === 0) {
    return NextResponse.json(
      { error: "Žádné klíčové dokumenty k zabalení (smlouva, očkování, zdravotní zpráva, registrace)." },
      { status: 404 },
    );
  }

  const zipBuffer = await zip.generateAsync({ type: "uint8array" });
  const filename = adoptionBundleName(a.record_number, a.name);
  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
