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
}

type Result = { error: string } | { ok: true };

export async function updateSettings(values: SettingsValues): Promise<Result> {
  const { institutionId, role } = await requireMembership();
  if (!["owner", "admin"].includes(role)) {
    return { error: "Na úpravu nastavení nemáš oprávnění." };
  }

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
      is_published: values.is_published,
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
