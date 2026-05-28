"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { APPLICATION_STATUS_LABEL } from "@/lib/format";
import type { ApplicationStatus } from "@/types/database";

type ActionResult = { error: string } | { ok: true };

async function ownedApplication(id: string) {
  const { user, institutionId } = await requireMembership();
  const service = createServiceClient();
  const { data } = await service
    .from("applications")
    .select("id, status, institution_id, animal_id, applicant_user_id, applicant_name")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  return { user, institutionId, service, application: data };
}

export async function setApplicationStatus(
  id: string,
  status: ApplicationStatus,
  note?: string,
): Promise<ActionResult> {
  const { user, service, application } = await ownedApplication(id);
  if (!application) return { error: "Žádost nepatří tvému útulku." };
  if (application.status === status) return { ok: true };

  const trimmedNote = note?.trim() || null;

  const { error } = await service
    .from("applications")
    .update({
      status,
      rejection_reason:
        status === "rejected" ? trimmedNote : null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  await service.from("application_events").insert({
    application_id: id,
    actor_user_id: user.id,
    event_type: "status_change",
    from_status: application.status as ApplicationStatus,
    to_status: status,
    note: trimmedNote,
  });

  // Notifikace pro přihlášeného žadatele
  if (application.applicant_user_id) {
    await service.from("notifications").insert({
      user_id: application.applicant_user_id,
      institution_id: application.institution_id,
      type: "application_status_change",
      title: `Stav tvé žádosti: ${APPLICATION_STATUS_LABEL[status]}`,
      body: trimmedNote,
      link: `/profil`,
      metadata: { application_id: id, animal_id: application.animal_id },
    });
  }

  revalidatePath("/admin/applications");
  revalidatePath(`/admin/applications/${id}`);
  return { ok: true };
}

export async function saveInternalNotes(
  id: string,
  notes: string,
): Promise<ActionResult> {
  const { service, application } = await ownedApplication(id);
  if (!application) return { error: "Žádost nepatří tvému útulku." };

  const { error } = await service
    .from("applications")
    .update({ internal_notes: notes.trim() || null })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath(`/admin/applications/${id}`);
  return { ok: true };
}
