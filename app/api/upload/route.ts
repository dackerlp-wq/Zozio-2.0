import { NextResponse, type NextRequest } from "next/server";

import { getCurrentMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
const IMAGE_ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

// Dokumenty — větší limit a širší množina typů (zprávy, smlouvy, scany…).
const DOC_MAX_BYTES = 20 * 1024 * 1024;
const DOC_ALLOWED = [
  ...IMAGE_ALLOWED,
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "image/heic",
  "image/tiff",
];

export async function POST(request: NextRequest) {
  // Přihlášení je povinné. Členství v útulku jen pro dokumenty — obrázky
  // (logo/hero) jde nahrát i během onboardingu, než útulek vznikne.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nejste přihlášeni." }, { status: 401 });
  }
  const membership = await getCurrentMembership();

  const form = await request.formData();
  const file = form.get("file");
  const isDocument = form.get("kind") === "document";
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Chybí soubor." }, { status: 400 });
  }
  if (isDocument && !membership) {
    return NextResponse.json({ error: "Nemáš oprávnění nahrávat dokumenty." }, { status: 403 });
  }
  // Složka: útulek (po vzniku), jinak osobní složka uživatele (onboarding).
  const folder = membership?.institutionId ?? `onboarding/${user.id}`;

  const maxBytes = isDocument ? DOC_MAX_BYTES : IMAGE_MAX_BYTES;
  const allowed = isDocument ? DOC_ALLOWED : IMAGE_ALLOWED;
  if (file.size > maxBytes) {
    return NextResponse.json(
      {
        error: `Soubor je příliš velký (max ${Math.round(maxBytes / 1024 / 1024)} MB).`,
      },
      { status: 400 },
    );
  }
  if (!allowed.includes(file.type)) {
    return NextResponse.json(
      {
        error: isDocument
          ? "Nepodporovaný formát (povolené: PDF, Word, Excel, obrázky, text)."
          : "Povolené jsou jen obrázky (JPG, PNG, WebP, AVIF).",
      },
      { status: 400 },
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "bin";
  // Dokumenty → privátní bucket (mohou obsahovat osobní údaje), obrázky → veřejný.
  const bucket = isDocument ? "animal-documents" : "animals";
  const path = `${folder}/${crypto.randomUUID()}.${ext}`;

  const service = createServiceClient();
  const { error } = await service.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    return NextResponse.json(
      { error: `Upload selhal: ${error.message}` },
      { status: 500 },
    );
  }

  // Privátní dokumenty nemají trvalou veřejnou URL — vrací se jen cesta.
  if (isDocument) {
    return NextResponse.json({ url: null, path, bucket });
  }

  const { data } = service.storage.from(bucket).getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path });
}
