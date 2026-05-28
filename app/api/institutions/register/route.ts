import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { slugify } from "@/lib/slug";

export async function POST(request: NextRequest) {
  // 1. Ověř přihlášení (server client + RLS)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nejste přihlášeni." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json(
      { error: "Název útulku je povinný." },
      { status: 400 },
    );
  }

  const service = createServiceClient();

  // 2. Už je členem nějakého útulku? (1 user : 1 instituce)
  const { data: existing } = await service
    .from("institution_members")
    .select("id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { error: "Už spravuješ jiný útulek." },
      { status: 409 },
    );
  }

  // 3. Unikátní slug
  const baseSlug = slugify(body.slug || body.name);
  let slug = baseSlug || `utulek-${Date.now().toString(36)}`;
  for (let i = 0; i < 20; i++) {
    const { data: clash } = await service
      .from("institutions")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!clash) break;
    slug = `${baseSlug}-${i + 2}`;
  }

  // 4. Vytvoř instituci
  const { data: inst, error: instErr } = await service
    .from("institutions")
    .insert({
      slug,
      name: body.name.trim(),
      type: body.type === "rescue_station" ? "rescue_station" : "shelter",
      region: body.region?.trim() || null,
      city: body.city?.trim() || null,
      email: body.email?.trim() || user.email || null,
      phone: body.phone?.trim() || null,
      is_published: false, // skryté dokud nepřidají zvířata / nepotvrdí
    })
    .select("id, slug")
    .single();

  if (instErr || !inst) {
    return NextResponse.json(
      { error: "Útulek se nepodařilo vytvořit." },
      { status: 500 },
    );
  }

  // 5. Membership = owner
  const { error: memberErr } = await service
    .from("institution_members")
    .insert({
      institution_id: inst.id,
      user_id: user.id,
      role: "owner",
    });
  if (memberErr) {
    // rollback instituce
    await service.from("institutions").delete().eq("id", inst.id);
    return NextResponse.json(
      { error: "Nepodařilo se přiřadit členství." },
      { status: 500 },
    );
  }

  // 6. Denormalizovaná role do user_metadata (pro proxy routing)
  await service.auth.admin.updateUserById(user.id, {
    user_metadata: { ...user.user_metadata, role: "owner" },
  });

  return NextResponse.json({ ok: true, slug: inst.slug });
}
