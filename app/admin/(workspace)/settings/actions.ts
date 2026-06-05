"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

export interface SettingsValues {
  // Profil & zveřejnění
  name: string;
  description: string;
  logo_url: string;
  hero_url: string;
  email: string;
  phone: string;
  website: string;
  region: string;
  city: string;
  address: string;
  lat: number | null;
  lng: number | null;
  facebook_url: string;
  instagram_url: string;
  opening_hours: string;
  is_published: boolean;
  // Provoz
  housing_mode: "physical" | "foster_network" | "hybrid";
  foster_enabled: boolean;
  // Evidence & lhůty
  protection_period_months: number;
  record_number_format: string;
  registration_number: string;
  kvs_region: string;
  ico: string;
  legal_form: string;
  staff_can_manage_legal: boolean;
  // Adopce
  accept_web_applications: boolean;
  screening_form_enabled: boolean;
  trial_period_days: number;
  adoption_fee_default: number | null;
  foster_fee_enabled: boolean;
  contract_template_url: string;
  // Web & katalog
  show_protected_in_catalog: boolean;
  widget_enabled: boolean;
  custom_domain: string;
  // Dary & platby
  darujme_org_id: string;
  bank_account: string;
  // E-maily & notifikace
  email_from: string;
  email_reply_to: string;
  auto_emails_enabled: boolean;
  task_digest_enabled: boolean;
  // Reklamy
  custom_ads_enabled: boolean;
  // Účet & data
  locale: string;
  timezone: string;
}

type Result = { error: string } | { ok: true };

export async function updateSettings(values: SettingsValues): Promise<Result> {
  const { institutionId, role, institution } = await requireMembership();
  if (!["owner", "admin"].includes(role)) {
    return { error: "Na úpravu nastavení nemáš oprávnění." };
  }
  if (!values.name.trim()) return { error: "Vyplň název útulku." };

  // Zveřejnit lze jen ověřený útulek.
  const canPublish = institution.verification_status === "approved";
  const is_published = canPublish ? values.is_published : false;

  const service = createServiceClient();
  const { error } = await service
    .from("institutions")
    .update({
      name: values.name.trim(),
      description: values.description.trim() || null,
      logo_url: values.logo_url || null,
      hero_url: values.hero_url || null,
      email: values.email.trim() || null,
      phone: values.phone.trim() || null,
      website: values.website.trim() || null,
      region: values.region.trim() || null,
      city: values.city.trim() || null,
      address: values.address.trim() || null,
      lat: values.lat,
      lng: values.lng,
      facebook_url: values.facebook_url.trim() || null,
      instagram_url: values.instagram_url.trim() || null,
      opening_hours: values.opening_hours.trim() || null,
      is_published,
      housing_mode: values.housing_mode,
      foster_enabled: values.foster_enabled,
      protection_period_months: Math.min(
        24,
        Math.max(1, Math.round(values.protection_period_months || 4)),
      ),
      record_number_format: values.record_number_format.trim() || "YYYY/0001",
      registration_number: values.registration_number.trim() || null,
      kvs_region: values.kvs_region.trim() || null,
      ico: values.ico.trim() || null,
      legal_form: values.legal_form.trim() || null,
      staff_can_manage_legal: values.staff_can_manage_legal,
      accept_web_applications: values.accept_web_applications,
      screening_form_enabled: values.screening_form_enabled,
      trial_period_days: Math.max(0, Math.round(values.trial_period_days || 0)),
      adoption_fee_default: values.adoption_fee_default,
      foster_fee_enabled: values.foster_fee_enabled,
      contract_template_url: values.contract_template_url.trim() || null,
      show_protected_in_catalog: values.show_protected_in_catalog,
      widget_enabled: values.widget_enabled,
      custom_domain: values.custom_domain.trim() || null,
      darujme_org_id: values.darujme_org_id.trim() || null,
      bank_account: values.bank_account.trim() || null,
      email_from: values.email_from.trim() || null,
      email_reply_to: values.email_reply_to.trim() || null,
      auto_emails_enabled: values.auto_emails_enabled,
      task_digest_enabled: values.task_digest_enabled,
      custom_ads_enabled: values.custom_ads_enabled,
      locale: values.locale.trim() || "cs",
      timezone: values.timezone.trim() || "Europe/Prague",
    })
    .eq("id", institutionId);

  if (error) return { error: error.message };

  const { data: inst } = await service
    .from("institutions")
    .select("slug")
    .eq("id", institutionId)
    .single();

  revalidatePath("/admin/settings");
  revalidatePath("/admin/dashboard");
  revalidatePath("/admin", "layout");
  if (inst?.slug) revalidatePath(`/utulek/${inst.slug}`);
  return { ok: true };
}

/**
 * Nevratné smazání útulku (jen vlastník). Smaže provozní data v pořadí
 * závislostí, členství a nakonec instituci. Přihlašovací účet zůstává.
 */
export async function deleteInstitution(confirmName: string): Promise<Result> {
  const { institutionId, role, institution } = await requireMembership();
  if (role !== "owner") {
    return { error: "Smazat útulek může jen vlastník." };
  }
  if (confirmName.trim() !== institution.name) {
    return { error: "Zadaný název nesouhlasí." };
  }

  const service = createServiceClient();
  await deleteViaBuilder(service, institutionId);
  return { ok: true };
}

async function deleteViaBuilder(
  service: ReturnType<typeof createServiceClient>,
  I: string,
): Promise<void> {
  const { data: animalRows } = await service
    .from("animals")
    .select("id")
    .eq("institution_id", I);
  const aIds = (animalRows ?? []).map((r) => (r as { id: string }).id);
  const { data: appRows } = await service
    .from("applications")
    .select("id")
    .eq("institution_id", I);
  const appIds = (appRows ?? []).map((r) => (r as { id: string }).id);
  const { data: kennelRows } = await service
    .from("kennels")
    .select("id")
    .eq("institution_id", I);
  const kIds = (kennelRows ?? []).map((r) => (r as { id: string }).id);

  const byAnimal = (t: string) =>
    aIds.length ? service.from(t).delete().in("animal_id", aIds) : null;
  const byInst = (t: string) => service.from(t).delete().eq("institution_id", I);

  if (appIds.length) await service.from("application_events").delete().in("application_id", appIds);
  await byAnimal("adoption_checkins");
  await byAnimal("adoption_communications");
  await byInst("adoptions");
  await byInst("applications");
  await byAnimal("foster_checkins");
  await byAnimal("foster_communications");
  await byInst("foster_placements");
  await byInst("foster_carers");
  await byAnimal("medication_doses");
  await byAnimal("treatments");
  await byAnimal("vaccinations");
  await byAnimal("vet_records");
  await byAnimal("weight_logs");
  await byInst("animal_conditions");
  await byAnimal("quarantine_contacts");
  await byAnimal("quarantine_observations");
  await byInst("quarantine_records");
  await byInst("animal_costs");
  await byInst("animal_donations");
  await byInst("animal_documents");
  await byInst("animal_exit_records");
  await byInst("animal_incidents");
  await byInst("animal_field_history");
  await byAnimal("animal_status_events");
  await byInst("care_log_entries");
  await byInst("animal_tasks");
  await byInst("task_schedules");
  await byInst("notifications");
  await byInst("export_log");
  await byInst("export_column_templates");
  if (kIds.length) await service.from("kennel_assignments").delete().in("kennel_id", kIds);
  await byInst("animals");
  await byInst("kennels");
  await byInst("animal_breeds");
  await byInst("institution_members");
  await service.from("institutions").delete().eq("id", I);
}
