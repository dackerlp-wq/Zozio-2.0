import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/types/database";

interface Payload {
  animal_id?: string;
  applicant_name?: string;
  applicant_email?: string;
  applicant_phone?: string;
  applicant_city?: string;
  applicant_message?: string;
  applicant_data?: Json;
  // honeypot — boti vyplní, lidé ne
  website?: string;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Payload | null;
  if (!body) {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  }

  // Honeypot: tváříme se úspěšně, ale nic neukládáme.
  if (body.website && body.website.trim()) {
    return NextResponse.json({ ok: true });
  }

  const animalId = body.animal_id?.trim();
  const name = body.applicant_name?.trim();
  const email = body.applicant_email?.trim().toLowerCase();

  if (!animalId || !name || !email) {
    return NextResponse.json(
      { error: "Jméno, e-mail a zvíře jsou povinné." },
      { status: 400 },
    );
  }
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Zadej platný e-mail." },
      { status: 400 },
    );
  }

  const service = createServiceClient();

  // 1. Ověř že zvíře existuje a je k adopci
  const { data: animal } = await service
    .from("animals")
    .select("id, name, institution_id, adoption_status")
    .eq("id", animalId)
    .maybeSingle();

  if (!animal) {
    return NextResponse.json({ error: "Zvíře nenalezeno." }, { status: 404 });
  }
  if (animal.adoption_status !== "available") {
    return NextResponse.json(
      { error: "Toto zvíře už není k adopci." },
      { status: 409 },
    );
  }

  // 2. Pokud je žadatel přihlášený, navážeme jeho účet
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 3. Vlož žádost
  const { data: application, error: insertErr } = await service
    .from("applications")
    .insert({
      animal_id: animal.id,
      institution_id: animal.institution_id,
      applicant_user_id: user?.id ?? null,
      applicant_name: name,
      applicant_email: email,
      applicant_phone: body.applicant_phone?.trim() || null,
      applicant_city: body.applicant_city?.trim() || null,
      applicant_message: body.applicant_message?.trim() || null,
      applicant_data: body.applicant_data ?? {},
      status: "new",
    })
    .select("id")
    .single();

  if (insertErr || !application) {
    return NextResponse.json(
      { error: "Žádost se nepodařilo odeslat. Zkus to prosím znovu." },
      { status: 500 },
    );
  }

  // 4. Audit event
  await service.from("application_events").insert({
    application_id: application.id,
    actor_user_id: user?.id ?? null,
    event_type: "created",
    to_status: "new",
    note: null,
  });

  // 5. Notifikace pro členy útulku
  const { data: members } = await service
    .from("institution_members")
    .select("user_id")
    .eq("institution_id", animal.institution_id);

  if (members?.length) {
    await service.from("notifications").insert(
      members.map((m) => ({
        user_id: m.user_id,
        institution_id: animal.institution_id,
        type: "new_application" as const,
        title: `Nová žádost o adopci — ${animal.name}`,
        body: `${name} má zájem o adopci.`,
        link: `/admin/applications/${application.id}`,
        metadata: { application_id: application.id, animal_id: animal.id },
      })),
    );
  }

  return NextResponse.json({ ok: true, id: application.id });
}
