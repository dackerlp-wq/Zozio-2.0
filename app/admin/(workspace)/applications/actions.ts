"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { APPLICATION_STATUS_LABEL, SEX_LABEL, SPECIES_LABEL } from "@/lib/format";
import { sendEmail } from "@/lib/email/send";
import { ApplicationInReviewEmail } from "@/lib/email/templates/application-in-review";
import { ApplicationPhoneMissedEmail } from "@/lib/email/templates/application-phone-missed";
import { ApplicationMeetingEmail } from "@/lib/email/templates/application-meeting";
import { ApplicationApprovedEmail } from "@/lib/email/templates/application-approved";
import { ApplicationCompletedEmail } from "@/lib/email/templates/application-completed";
import { ApplicationRejectedEmail } from "@/lib/email/templates/application-rejected";
import { renderAdoptionContract } from "@/lib/pdf/adoption-contract";
import type {
  AdoptionStatus,
  AnimalLegalStatus,
  ApplicationStatus,
} from "@/types/database";

type ActionResult = { error: string } | { ok: true };

const todayStr = () => new Date().toISOString().slice(0, 10);

/** Žádost + napojené zvíře a instituce, vše potřebné pro workflow a e-maily. */
interface AppCtx {
  id: string;
  status: ApplicationStatus;
  institution_id: string;
  animal_id: string | null;
  applicant_user_id: string | null;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  applicant_city: string | null;
  applicant_data: Record<string, unknown> | null;
  reserved_at: string | null;
  meeting_at: string | null;
  meeting_location: string | null;
  animal: {
    id: string;
    name: string;
    species: string;
    breed: string | null;
    is_crossbreed: boolean;
    breed_secondary: string | null;
    sex: string;
    color: string | null;
    chip_number: string | null;
    record_number: string | null;
    adoption_status: AdoptionStatus;
    legal_status: string;
  } | null;
  institution: {
    name: string;
    legal_name: string | null;
    ico: string | null;
    address: string | null;
    city: string | null;
    email: string | null;
    phone: string | null;
    adoption_fee_default: number | null;
  } | null;
}

async function load(id: string) {
  const { user, institutionId } = await requireMembership();
  const service = createServiceClient();
  const { data } = await service
    .from("applications")
    .select(
      `id, status, institution_id, animal_id, applicant_user_id,
       applicant_name, applicant_email, applicant_phone, applicant_city,
       applicant_data, reserved_at, meeting_at, meeting_location,
       animal:animals(id, name, species, breed, is_crossbreed, breed_secondary,
         sex, color, chip_number, record_number, adoption_status, legal_status),
       institution:institutions(name, legal_name, ico, address, city, email,
         phone, adoption_fee_default)`,
    )
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  return {
    user,
    institutionId,
    service,
    app: (data as unknown as AppCtx | null) ?? null,
  };
}

type Service = ReturnType<typeof createServiceClient>;

/** Zapíše událost do historie žádosti. */
async function logEvent(
  service: Service,
  app: AppCtx,
  userId: string,
  to: ApplicationStatus,
  note: string | null,
) {
  await service.from("application_events").insert({
    application_id: app.id,
    actor_user_id: userId,
    event_type: "status_change",
    from_status: app.status,
    to_status: to,
    note,
  });
}

/** Notifikace pro přihlášeného žadatele (pokud existuje účet). */
async function notify(
  service: Service,
  app: AppCtx,
  status: ApplicationStatus,
  body: string | null,
) {
  if (!app.applicant_user_id) return;
  await service.from("notifications").insert({
    user_id: app.applicant_user_id,
    institution_id: app.institution_id,
    type: "application_status_change",
    title: `Stav tvé žádosti: ${APPLICATION_STATUS_LABEL[status]}`,
    body,
    link: "/profil",
    metadata: { application_id: app.id, animal_id: app.animal_id },
  });
}

/** Změní stav zvířete + zapíše audit (jen pokud se mění). */
async function setAnimalStatus(
  service: Service,
  app: AppCtx,
  to: AdoptionStatus,
  note: string,
  userId: string,
) {
  if (!app.animal) return;
  const from = app.animal.adoption_status;
  if (from === to) return;
  const patch: {
    adoption_status: AdoptionStatus;
    legal_status?: AnimalLegalStatus;
  } = {
    adoption_status: to,
  };
  if (to === "adopted") patch.legal_status = "transferred_out";
  await service.from("animals").update(patch).eq("id", app.animal.id);
  await service.from("animal_status_events").insert({
    animal_id: app.animal.id,
    from_status: from,
    to_status: to,
    note,
    changed_by: userId,
  });
}

function feeLabel(fee: number | null, fallback: number | null): string {
  const v = fee ?? fallback;
  if (v == null) return "dle dohody";
  if (v === 0) return "zdarma";
  return `${v.toLocaleString("cs-CZ")} Kč`;
}

function meetingLabelCs(iso: string): string {
  return new Date(iso).toLocaleString("cs-CZ", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function firstName(full: string): string {
  return full.trim().split(/\s+/)[0] || full;
}

function revalidate(id: string) {
  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${id}`);
}

// --- Workflow akce ---------------------------------------------------------

/** Posun do posuzování (Nová → V posouzení) + informační e-mail. */
export async function moveToReview(id: string): Promise<ActionResult> {
  const { user, service, app } = await load(id);
  if (!app) return { error: "Žádost nepatří tvému útulku." };

  await service.from("applications").update({ status: "review" }).eq("id", id);
  await logEvent(service, app, user.id, "review", null);
  await notify(service, app, "review", null);

  if (app.animal) {
    await sendEmail({
      to: app.applicant_email,
      subject: `Probíhá posouzení žádosti o ${app.animal.name}`,
      react: ApplicationInReviewEmail({
        applicantName: firstName(app.applicant_name),
        animalName: app.animal.name,
        institutionName: app.institution?.name ?? "útulek",
      }),
      replyTo: app.institution?.email ?? undefined,
    });
  }

  revalidate(id);
  return { ok: true };
}

/**
 * Úspěšný telefonický kontakt — zájemce potvrdil zájem, rezervujeme zvíře.
 * Žádný e-mail se neodesílá (domluveno telefonicky).
 */
export async function confirmPhoneContact(id: string): Promise<ActionResult> {
  const { user, service, app } = await load(id);
  if (!app) return { error: "Žádost nepatří tvému útulku." };

  await service
    .from("applications")
    .update({ status: "phone_contact", reserved_at: new Date().toISOString() })
    .eq("id", id);
  await logEvent(
    service,
    app,
    user.id,
    "phone_contact",
    "Telefonický kontakt úspěšný — zájem potvrzen, zvíře rezervováno",
  );
  await notify(service, app, "phone_contact", null);

  await setAnimalStatus(
    service,
    app,
    "reserved",
    "Rezervováno na základě žádosti o adopci",
    user.id,
  );

  revalidate(id);
  return { ok: true };
}

/**
 * Nedokončený telefonický kontakt (nezvedl / jiný problém) — pošleme výzvu,
 * aby se zájemce ozval. Zvíře se nerezervuje.
 */
export async function markPhoneIncomplete(
  id: string,
  note?: string,
): Promise<ActionResult> {
  const { user, service, app } = await load(id);
  if (!app) return { error: "Žádost nepatří tvému útulku." };

  const trimmed = note?.trim() || null;
  await service
    .from("applications")
    .update({ status: "phone_contact" })
    .eq("id", id);
  await logEvent(
    service,
    app,
    user.id,
    "phone_contact",
    `Telefonický kontakt nedokončený${trimmed ? ` — ${trimmed}` : ""}`,
  );
  await notify(service, app, "phone_contact", "Nepodařilo se nám vás zastihnout.");

  if (app.animal) {
    await sendEmail({
      to: app.applicant_email,
      subject: `Nepodařilo se nám vás zastihnout — ${app.animal.name}`,
      react: ApplicationPhoneMissedEmail({
        applicantName: firstName(app.applicant_name),
        animalName: app.animal.name,
        institutionName: app.institution?.name ?? "útulek",
        institutionPhone: app.institution?.phone ?? null,
        institutionEmail: app.institution?.email ?? null,
      }),
      replyTo: app.institution?.email ?? undefined,
    });
  }

  revalidate(id);
  return { ok: true };
}

/** Naplánuje osobní schůzku (datum+čas zadá zaměstnanec) + e-mail s termínem. */
export async function scheduleMeeting(
  id: string,
  meetingAtISO: string,
  location?: string,
): Promise<ActionResult> {
  const { user, service, app } = await load(id);
  if (!app) return { error: "Žádost nepatří tvému útulku." };

  const at = new Date(meetingAtISO);
  if (Number.isNaN(at.getTime())) return { error: "Neplatný termín schůzky." };

  const loc = location?.trim() || null;
  await service
    .from("applications")
    .update({
      status: "in_person_meeting",
      meeting_at: at.toISOString(),
      meeting_location: loc,
      // Nový termín → znovu povolit připomínku den předem.
      meeting_reminder_sent_at: null,
    })
    .eq("id", id);

  const label = meetingLabelCs(at.toISOString());
  await logEvent(
    service,
    app,
    user.id,
    "in_person_meeting",
    `Osobní schůzka naplánována na ${label}${loc ? ` · ${loc}` : ""}`,
  );
  await notify(service, app, "in_person_meeting", `Termín: ${label}`);

  if (app.animal) {
    await sendEmail({
      to: app.applicant_email,
      subject: `Osobní schůzka kvůli ${app.animal.name} — ${label}`,
      react: ApplicationMeetingEmail({
        applicantName: firstName(app.applicant_name),
        animalName: app.animal.name,
        institutionName: app.institution?.name ?? "útulek",
        meetingLabel: label,
        location: loc ?? app.institution?.address ?? null,
      }),
      replyTo: app.institution?.email ?? undefined,
    });
  }

  revalidate(id);
  return { ok: true };
}

function composeBreed(animal: NonNullable<AppCtx["animal"]>): string | null {
  const parts = [animal.breed, animal.breed_secondary].filter(
    (b): b is string => Boolean(b && b.trim()),
  );
  if (animal.is_crossbreed) {
    return parts.length ? `kříženec (${parts.join(" × ")})` : "kříženec";
  }
  return parts.length ? parts.join(" × ") : null;
}

/**
 * Schválení adopce — založí běžící adopci, vygeneruje PDF smlouvu a pošle
 * schvalovací e-mail s přílohou. Zvíře zůstává rezervované.
 */
export async function approveApplication(
  id: string,
  fee: number | null,
): Promise<ActionResult> {
  const { user, service, app } = await load(id);
  if (!app) return { error: "Žádost nepatří tvému útulku." };
  if (!app.animal) return { error: "Žádost nemá navázané zvíře." };

  await service.from("applications").update({ status: "approved" }).eq("id", id);

  // Auto-založení běžící adopce (jen pokud ještě neexistuje).
  const { count } = await service
    .from("adoptions")
    .select("id", { count: "exact", head: true })
    .eq("animal_id", app.animal.id)
    .in("stage", ["trial", "finalized"]);
  if ((count ?? 0) === 0) {
    await service.from("adoptions").insert({
      animal_id: app.animal.id,
      institution_id: app.institution_id,
      application_id: app.id,
      adopter_name: app.applicant_name,
      adopter_email: app.applicant_email,
      adopter_phone: app.applicant_phone,
      adopter_address: app.applicant_city,
      stage: "trial",
      started_on: todayStr(),
      fee,
      created_by: user.id,
    });
  }

  await logEvent(service, app, user.id, "approved", "Adopce schválena");
  await notify(service, app, "approved", null);

  // PDF smlouva → příloha e-mailu.
  const inst = app.institution;
  const feeStr = feeLabel(fee, inst?.adoption_fee_default ?? null);
  let attachment: { filename: string; content: Buffer } | null = null;
  try {
    const contractNumber = `S-${new Date().getFullYear()}-${id.slice(0, 8).toUpperCase()}`;
    const pdf = await renderAdoptionContract({
      contractNumber,
      dateLabel: new Date().toLocaleDateString("cs-CZ"),
      institution: {
        name: inst?.legal_name?.trim() || inst?.name || "Útulek",
        address: [inst?.address, inst?.city].filter(Boolean).join(", ") || null,
        ico: inst?.ico ?? null,
        email: inst?.email ?? null,
        phone: inst?.phone ?? null,
      },
      adopter: {
        name: app.applicant_name,
        address: app.applicant_city,
        email: app.applicant_email,
        phone: app.applicant_phone,
      },
      animal: {
        name: app.animal.name,
        species: SPECIES_LABEL[app.animal.species] ?? app.animal.species,
        breed: composeBreed(app.animal),
        sex: SEX_LABEL[app.animal.sex] ?? app.animal.sex,
        color: app.animal.color,
        chip: app.animal.chip_number,
        recordNumber: app.animal.record_number,
      },
      feeLabel: feeStr,
    });
    attachment = { filename: `adopcni-smlouva-${app.animal.name}.pdf`, content: pdf };
  } catch (e) {
    console.error("[approveApplication] PDF render failed:", e);
  }

  await sendEmail({
    to: app.applicant_email,
    subject: `Adopce ${app.animal.name} schválena 🎉`,
    react: ApplicationApprovedEmail({
      applicantName: firstName(app.applicant_name),
      animalName: app.animal.name,
      institutionName: inst?.name ?? "útulek",
      feeLabel: feeStr,
    }),
    replyTo: inst?.email ?? undefined,
    attachments: attachment ? [attachment] : undefined,
  });

  revalidate(id);
  return { ok: true };
}

/** Smlouva podepsána (žádný e-mail). */
export async function markContractSigned(id: string): Promise<ActionResult> {
  const { user, service, app } = await load(id);
  if (!app) return { error: "Žádost nepatří tvému útulku." };

  await service
    .from("applications")
    .update({ status: "contract_signed" })
    .eq("id", id);
  await logEvent(service, app, user.id, "contract_signed", "Smlouva podepsána");
  await notify(service, app, "contract_signed", null);

  if (app.animal) {
    await service
      .from("adoptions")
      .update({ contract_signed_at: new Date().toISOString() })
      .eq("animal_id", app.animal.id)
      .eq("stage", "trial");
  }

  revalidate(id);
  return { ok: true };
}

/**
 * Dokončení adopce po předání — zvíře označíme jako adoptované, adopci
 * finalizujeme a pošleme závěrečný e-mail s doporučeními.
 */
export async function completeAdoption(
  id: string,
  recommendations?: string,
): Promise<ActionResult> {
  const { user, service, app } = await load(id);
  if (!app) return { error: "Žádost nepatří tvému útulku." };

  await service.from("applications").update({ status: "completed" }).eq("id", id);
  await logEvent(service, app, user.id, "completed", "Adopce dokončena — předáno");
  await notify(service, app, "completed", null);

  if (app.animal) {
    await service
      .from("adoptions")
      .update({ stage: "finalized", finalized_on: todayStr() })
      .eq("animal_id", app.animal.id)
      .eq("stage", "trial");

    await setAnimalStatus(
      service,
      app,
      "adopted",
      "Adopce dokončena — zvíře předáno adoptantovi",
      user.id,
    );

    await sendEmail({
      to: app.applicant_email,
      subject: `${app.animal.name} je doma — děkujeme!`,
      react: ApplicationCompletedEmail({
        applicantName: firstName(app.applicant_name),
        animalName: app.animal.name,
        institutionName: app.institution?.name ?? "útulek",
        recommendations: recommendations?.trim() || null,
      }),
      replyTo: app.institution?.email ?? undefined,
    });
  }

  revalidate(id);
  return { ok: true };
}

/** Zamítnutí žádosti — e-mail + uvolnění rezervovaného zvířete zpět k adopci. */
export async function rejectApplication(
  id: string,
  reason?: string,
): Promise<ActionResult> {
  const { user, service, app } = await load(id);
  if (!app) return { error: "Žádost nepatří tvému útulku." };

  const trimmed = reason?.trim() || null;
  await service
    .from("applications")
    .update({ status: "rejected", rejection_reason: trimmed })
    .eq("id", id);
  await logEvent(service, app, user.id, "rejected", trimmed);
  await notify(service, app, "rejected", trimmed);

  // Uvolnit zvíře, pokud bylo kvůli této žádosti rezervované.
  if (app.animal && app.animal.adoption_status === "reserved") {
    await setAnimalStatus(
      service,
      app,
      "available",
      "Rezervace uvolněna — žádost zamítnuta",
      user.id,
    );
    await service
      .from("applications")
      .update({ reserved_at: null })
      .eq("id", id);
  }

  if (app.animal) {
    await sendEmail({
      to: app.applicant_email,
      subject: `Vyjádření k žádosti o adopci ${app.animal.name}`,
      react: ApplicationRejectedEmail({
        applicantName: firstName(app.applicant_name),
        animalName: app.animal.name,
        institutionName: app.institution?.name ?? "útulek",
        reason: trimmed,
      }),
      replyTo: app.institution?.email ?? undefined,
    });
  }

  revalidate(id);
  return { ok: true };
}

export async function saveInternalNotes(
  id: string,
  notes: string,
): Promise<ActionResult> {
  const { service, app } = await load(id);
  if (!app) return { error: "Žádost nepatří tvému útulku." };

  const { error } = await service
    .from("applications")
    .update({ internal_notes: notes.trim() || null })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/admin/applications/${id}`);
  return { ok: true };
}
