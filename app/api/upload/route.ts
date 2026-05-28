import { NextResponse, type NextRequest } from "next/server";

import { getCurrentMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

const MAX_BYTES = 8 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export async function POST(request: NextRequest) {
  // Jen členové útulku můžou nahrávat
  const membership = await getCurrentMembership();
  if (!membership) {
    return NextResponse.json({ error: "Nejste přihlášeni." }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Chybí soubor." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Soubor je příliš velký (max 8 MB)." },
      { status: 400 },
    );
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json(
      { error: "Povolené jsou jen obrázky (JPG, PNG, WebP, AVIF)." },
      { status: 400 },
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const path = `${membership.institutionId}/${crypto.randomUUID()}.${ext}`;

  const service = createServiceClient();
  const { error } = await service.storage
    .from("animals")
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    return NextResponse.json(
      { error: `Upload selhal: ${error.message}` },
      { status: 500 },
    );
  }

  const { data } = service.storage.from("animals").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, path });
}
