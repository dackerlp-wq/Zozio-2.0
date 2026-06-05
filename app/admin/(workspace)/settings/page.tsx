import { redirect } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { InstitutionRow } from "@/types/database";

import { SettingsForm } from "./settings-form";
import { SETTINGS_SECTIONS, type SettingsSection } from "./sections";
import type { SettingsValues } from "./actions";

export const metadata = { title: "Nastavení — Zozio Admin" };

interface PageProps {
  searchParams: Promise<{ sekce?: string }>;
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const { institutionId, institution, role } = await requireMembership();
  // Nastavení je jen pro vlastníka/správce.
  if (role !== "owner" && role !== "admin") redirect("/admin/dashboard");

  const { sekce } = await searchParams;
  const section: SettingsSection = SETTINGS_SECTIONS.some((s) => s.key === sekce)
    ? (sekce as SettingsSection)
    : "profil";

  const supabase = await createClient();
  const { data } = await supabase
    .from("institutions")
    .select("*")
    .eq("id", institutionId)
    .single();

  const a = (data ?? {}) as Partial<InstitutionRow>;
  const initial: SettingsValues = {
    name: a.name ?? "",
    description: a.description ?? "",
    logo_url: a.logo_url ?? "",
    hero_url: a.hero_url ?? "",
    email: a.email ?? "",
    phone: a.phone ?? "",
    website: a.website ?? "",
    region: a.region ?? "",
    city: a.city ?? "",
    address: a.address ?? "",
    lat: a.lat ?? null,
    lng: a.lng ?? null,
    facebook_url: a.facebook_url ?? "",
    instagram_url: a.instagram_url ?? "",
    opening_hours: a.opening_hours ?? "",
    is_published: Boolean(a.is_published),
    housing_mode: a.housing_mode ?? "physical",
    foster_enabled: Boolean(a.foster_enabled),
    protection_period_months: a.protection_period_months ?? 4,
    record_number_format: a.record_number_format ?? "YYYY/0001",
    registration_number: a.registration_number ?? "",
    kvs_region: a.kvs_region ?? "",
    ico: a.ico ?? "",
    legal_form: a.legal_form ?? "",
    staff_can_manage_legal: Boolean(a.staff_can_manage_legal),
    accept_web_applications: a.accept_web_applications ?? true,
    screening_form_enabled: Boolean(a.screening_form_enabled),
    trial_period_days: a.trial_period_days ?? 14,
    adoption_fee_default: a.adoption_fee_default ?? null,
    foster_fee_enabled: Boolean(a.foster_fee_enabled),
    contract_template_url: a.contract_template_url ?? "",
    show_protected_in_catalog: Boolean(a.show_protected_in_catalog),
    widget_enabled: a.widget_enabled ?? true,
    custom_domain: a.custom_domain ?? "",
    darujme_org_id: a.darujme_org_id ?? "",
    bank_account: a.bank_account ?? "",
    email_from: a.email_from ?? "",
    email_reply_to: a.email_reply_to ?? "",
    auto_emails_enabled: a.auto_emails_enabled ?? true,
    task_digest_enabled: a.task_digest_enabled ?? true,
    custom_ads_enabled: Boolean(a.custom_ads_enabled),
    locale: a.locale ?? "cs",
    timezone: a.timezone ?? "Europe/Prague",
  };

  return (
    <SettingsForm
      initial={initial}
      section={section}
      role={role}
      plan={a.plan ?? "free"}
      institutionName={institution.name}
      verificationStatus={institution.verification_status}
    />
  );
}
