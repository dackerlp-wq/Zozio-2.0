"use server";

import { revalidatePath } from "next/cache";

import { requireSuperadmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { sendEmail } from "@/lib/email/send";
import { InstitutionApprovedEmail } from "@/lib/email/templates/institution-approved";
import { InstitutionRejectedEmail } from "@/lib/email/templates/institution-rejected";
import { InstitutionSuspendedEmail } from "@/lib/email/templates/institution-suspended";

type Result = { error: string } | { ok: true };

/** Kontaktní e-mail útulku → fallback na e-mail vlastníka (owner). */
async function institutionContact(
  service: ReturnType<typeof createServiceClient>,
  id: string,
): Promise<{ name: string; email: string | null }> {
  const { data: inst } = await service
    .from("institutions")
    .select("name, email")
    .eq("id", id)
    .single();

  const name = inst?.name ?? "Útulek";
  if (inst?.email) return { name, email: inst.email };

  // fallback: e-mail vlastníka z auth
  const { data: owner } = await service
    .from("institution_members")
    .select("user_id")
    .eq("institution_id", id)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  if (owner?.user_id) {
    const { data: user } = await service.auth.admin.getUserById(owner.user_id);
    return { name, email: user.user?.email ?? null };
  }
  return { name, email: null };
}

export async function approveInstitution(id: string): Promise<Result> {
  await requireSuperadmin();
  const service = createServiceClient();

  const { error } = await service
    .from("institutions")
    .update({
      verification_status: "approved",
      is_verified: true,
      verified_at: new Date().toISOString(),
      rejection_reason: null,
      suspended_at: null,
      suspension_reason: null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  // Notifikace útulku (best-effort — chyba e-mailu neblokuje schválení)
  const { name, email } = await institutionContact(service, id);
  if (email) {
    await sendEmail({
      to: email,
      subject: "Tvůj útulek byl ověřen — Zozio",
      react: InstitutionApprovedEmail({ institutionName: name }),
    });
  }

  revalidatePath("/superadmin/institutions");
  revalidatePath(`/superadmin/institutions/${id}`);
  return { ok: true };
}

export async function rejectInstitution(
  id: string,
  reason: string,
): Promise<Result> {
  await requireSuperadmin();
  if (!reason.trim()) {
    return { error: "Uveď prosím důvod zamítnutí." };
  }
  const service = createServiceClient();

  const { error } = await service
    .from("institutions")
    .update({
      verification_status: "rejected",
      is_verified: false,
      is_published: false,
      verified_at: null,
      rejection_reason: reason.trim(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  // Notifikace útulku (best-effort)
  const { name, email } = await institutionContact(service, id);
  if (email) {
    await sendEmail({
      to: email,
      subject: "Ověření útulku potřebuje doplnit — Zozio",
      react: InstitutionRejectedEmail({
        institutionName: name,
        reason: reason.trim(),
      }),
    });
  }

  revalidatePath("/superadmin/institutions");
  revalidatePath(`/superadmin/institutions/${id}`);
  return { ok: true };
}

/** Pozastaví ověřený útulek — skryje ho z veřejnosti a uloží důvod. */
export async function suspendInstitution(
  id: string,
  reason: string,
): Promise<Result> {
  await requireSuperadmin();
  if (!reason.trim()) {
    return { error: "Uveď prosím důvod pozastavení." };
  }
  const service = createServiceClient();

  const { error } = await service
    .from("institutions")
    .update({
      verification_status: "suspended",
      is_published: false,
      suspended_at: new Date().toISOString(),
      suspension_reason: reason.trim(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  // Notifikace útulku (best-effort)
  const { name, email } = await institutionContact(service, id);
  if (email) {
    await sendEmail({
      to: email,
      subject: "Tvůj útulek byl pozastaven — Zozio",
      react: InstitutionSuspendedEmail({
        institutionName: name,
        reason: reason.trim(),
      }),
    });
  }

  revalidatePath("/superadmin/institutions");
  revalidatePath(`/superadmin/institutions/${id}`);
  return { ok: true };
}

/** Obnoví pozastavený útulek zpět do stavu „ověřeno". */
export async function reactivateInstitution(id: string): Promise<Result> {
  await requireSuperadmin();
  const service = createServiceClient();

  const { error } = await service
    .from("institutions")
    .update({
      verification_status: "approved",
      is_verified: true,
      verified_at: new Date().toISOString(),
      suspended_at: null,
      suspension_reason: null,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  // Notifikace útulku (best-effort) — znovu aktivováno
  const { name, email } = await institutionContact(service, id);
  if (email) {
    await sendEmail({
      to: email,
      subject: "Tvůj útulek byl znovu aktivován — Zozio",
      react: InstitutionApprovedEmail({ institutionName: name }),
    });
  }

  revalidatePath("/superadmin/institutions");
  revalidatePath(`/superadmin/institutions/${id}`);
  return { ok: true };
}
