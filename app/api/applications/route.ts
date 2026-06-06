import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { adoptionFormBlock } from "@/lib/animal-readiness";
import { sendEmail } from "@/lib/email/send";
import { ApplicationReceivedEmail } from "@/lib/email/templates/application-received";
import { NewApplicationEmail } from "@/lib/email/templates/new-application";
import type { AnimalLegalStatus, Json } from "@/types/database";

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
    .select(
      "id, name, institution_id, adoption_status, legal_status, protection_until",
    )
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

  // Ochranná lhůta: žádost nelze podat, dokud lhůta neskončí.
  const block = adoptionFormBlock({
    legal_status: animal.legal_status as AnimalLegalStatus,
    protection_until: animal.protection_until as string | null,
  });
  if (block?.blocked) {
    return NextResponse.json({ error: block.reason }, { status: 409 });
  }

  // 1b. Duplicita — stejný e-mail × zvíře (mimo zamítnuté) podat znovu nelze.
  const { count: dupCount } = await service
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("animal_id", animal.id)
    .eq("applicant_email", email)
    .neq("status", "rejected");
  if ((dupCount ?? 0) > 0) {
    return NextResponse.json(
      { error: `Na ${animal.name} už od tebe žádost evidujeme — útulek se ti ozve.` },
      { status: 409 },
    );
  }

  // 1c. Rate limit — max 5 žádostí z jednoho e-mailu za hodinu (proti spamu).
  const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const { count: recentCount } = await service
    .from("applications")
    .select("id", { count: "exact", head: true })
    .eq("applicant_email", email)
    .gte("created_at", hourAgo);
  if ((recentCount ?? 0) >= 5) {
    return NextResponse.json(
      { error: "Příliš mnoho žádostí za krátkou dobu. Zkus to prosím později." },
      { status: 429 },
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

  // 6. Potvrzovací e-mail žadateli
  const { data: inst } = await service
    .from("institutions")
    .select("name, email")
    .eq("id", animal.institution_id)
    .maybeSingle();

  const isFoster =
    !!body.applicant_data &&
    typeof body.applicant_data === "object" &&
    (body.applicant_data as Record<string, unknown>).intent === "foster";

  await sendEmail({
    to: email,
    subject: `Žádost o adopci ${animal.name} jsme přijali`,
    react: ApplicationReceivedEmail({
      applicantName: name.split(/\s+/)[0] || name,
      animalName: animal.name,
      institutionName: inst?.name ?? "útulek",
    }),
    replyTo: inst?.email ?? undefined,
  });

  // 7. Upozornění útulku (navíc k in-app notifikaci).
  if (inst?.email) {
    await sendEmail({
      to: inst.email,
      subject: `${isFoster ? "Nová dočasná péče" : "Nová žádost"} — ${animal.name}`,
      react: NewApplicationEmail({
        animalName: animal.name,
        applicantName: name,
        applicantCity: body.applicant_city?.trim() || null,
        message: body.applicant_message?.trim() || null,
        isFoster,
        applicationId: application.id,
      }),
      replyTo: email,
    });
  }

  return NextResponse.json({ ok: true, id: application.id });
}
