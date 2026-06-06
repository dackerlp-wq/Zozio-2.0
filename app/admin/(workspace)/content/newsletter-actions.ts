"use server";

import { revalidatePath } from "next/cache";

import { ensurePermission } from "@/lib/auth";
import { SITE_URL } from "@/lib/email/config";
import { sendEmail } from "@/lib/email/send";
import { NewsletterEmail } from "@/lib/email/templates/newsletter";
import { sanitizeHtml } from "@/lib/sanitize";
import { createServiceClient } from "@/lib/supabase/service";
import type { NewsletterSubscriberRow } from "@/types/database";

type Result = { error: string } | { ok: true };

export interface CampaignInput {
  subject: string;
  body: string;
  segment: string;
}

export async function createCampaign(
  input: CampaignInput,
): Promise<{ ok: true; id: string } | { error: string }> {
  const perm = await ensurePermission("web");
  if (!perm.ok) return { error: perm.error };
  if (!input.subject.trim()) return { error: "Zadej předmět." };
  const service = createServiceClient();
  const { data, error } = await service
    .from("newsletter_campaigns")
    .insert({
      institution_id: perm.membership.institutionId,
      subject: input.subject.trim(),
      body: input.body ? sanitizeHtml(input.body) : null,
      segment: input.segment || "all",
      status: "draft",
      created_by: perm.membership.user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Nepodařilo se uložit." };
  revalidatePath("/admin/content");
  return { ok: true, id: data.id };
}

export async function updateCampaign(id: string, input: CampaignInput): Promise<Result> {
  const perm = await ensurePermission("web");
  if (!perm.ok) return { error: perm.error };
  const service = createServiceClient();
  const { error } = await service
    .from("newsletter_campaigns")
    .update({
      subject: input.subject.trim(),
      body: input.body ? sanitizeHtml(input.body) : null,
      segment: input.segment || "all",
    })
    .eq("id", id)
    .eq("institution_id", perm.membership.institutionId)
    .eq("status", "draft");
  if (error) return { error: error.message };
  revalidatePath("/admin/content");
  return { ok: true };
}

export async function deleteCampaign(id: string): Promise<Result> {
  const perm = await ensurePermission("web");
  if (!perm.ok) return { error: perm.error };
  const service = createServiceClient();
  const { error } = await service
    .from("newsletter_campaigns")
    .delete()
    .eq("id", id)
    .eq("institution_id", perm.membership.institutionId)
    .neq("status", "sent");
  if (error) return { error: error.message };
  revalidatePath("/admin/content");
  return { ok: true };
}

export async function scheduleCampaign(id: string, when: string): Promise<Result> {
  const perm = await ensurePermission("web");
  if (!perm.ok) return { error: perm.error };
  if (!when) return { error: "Zadej datum odeslání." };
  const service = createServiceClient();
  const { error } = await service
    .from("newsletter_campaigns")
    .update({ status: "scheduled", scheduled_at: when })
    .eq("id", id)
    .eq("institution_id", perm.membership.institutionId);
  if (error) return { error: error.message };
  revalidatePath("/admin/content");
  return { ok: true };
}

/** Reálně rozešle kampaň segmentu přes Resend (per-příjemce odhlášení). */
export async function sendCampaign(id: string): Promise<Result> {
  const perm = await ensurePermission("web");
  if (!perm.ok) return { error: perm.error };
  const { institutionId, institution } = perm.membership;
  const service = createServiceClient();

  const { data: camp } = await service
    .from("newsletter_campaigns")
    .select("subject, body, segment, status")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!camp) return { error: "Kampaň nenalezena." };
  const c = camp as { subject: string; body: string | null; segment: string; status: string };
  if (c.status === "sent") return { error: "Kampaň už byla odeslána." };

  let q = service
    .from("newsletter_subscribers")
    .select("id, email")
    .eq("institution_id", institutionId)
    .is("unsubscribed_at", null)
    .not("consent_at", "is", null);
  if (c.segment !== "all") q = q.eq("segment", c.segment as NewsletterSubscriberRow["segment"]);
  const { data: subs } = await q;
  const recipients = (subs ?? []) as Pick<NewsletterSubscriberRow, "id" | "email">[];

  let sent = 0;
  for (const sub of recipients) {
    const res = await sendEmail({
      to: sub.email,
      subject: c.subject,
      react: NewsletterEmail({
        institutionName: institution.name,
        subject: c.subject,
        bodyHtml: c.body ?? "",
        openPixelUrl: `${SITE_URL}/api/newsletter/open/${id}`,
        unsubscribeUrl: `${SITE_URL}/api/newsletter/unsubscribe?id=${sub.id}`,
      }),
    });
    if (res.ok) sent += 1;
  }

  await service
    .from("newsletter_campaigns")
    .update({ status: "sent", sent_at: new Date().toISOString(), recipients: sent })
    .eq("id", id)
    .eq("institution_id", institutionId);

  revalidatePath("/admin/content");
  return { ok: true };
}
