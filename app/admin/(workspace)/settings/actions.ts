"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

export interface SettingsValues {
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
  is_published: boolean;
  // Příjem, ochranná lhůta & adopce (migrace 0008)
  protection_period_months: number;
  show_protected_in_catalog: boolean;
  staff_can_manage_legal: boolean;
  adoption_fee_default: number | null;
  foster_fee_enabled: boolean;
}

type Result = { error: string } | { ok: true };

export async function updateSettings(values: SettingsValues): Promise<Result> {
  const { institutionId, role, institution } = await requireMembership();
  if (!["owner", "admin"].includes(role)) {
    return { error: "Na úpravu nastavení nemáš oprávnění." };
  }

  // Zveřejnit lze jen ověřený útulek
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
      is_published,
      protection_period_months: Math.min(
        24,
        Math.max(1, Math.round(values.protection_period_months || 4)),
      ),
      show_protected_in_catalog: values.show_protected_in_catalog,
      staff_can_manage_legal: values.staff_can_manage_legal,
      adoption_fee_default: values.adoption_fee_default,
      foster_fee_enabled: values.foster_fee_enabled,
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
  if (inst?.slug) revalidatePath(`/utulek/${inst.slug}`);
  return { ok: true };
}
