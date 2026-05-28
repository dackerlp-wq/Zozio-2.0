import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { SettingsForm } from "./settings-form";
import type { SettingsValues } from "./actions";

export const metadata = { title: "Nastavení — Zozio Admin" };

export default async function SettingsPage() {
  const { institutionId, institution } = await requireMembership();
  const supabase = await createClient();

  const { data } = await supabase
    .from("institutions")
    .select("*")
    .eq("id", institutionId)
    .single();

  const a = (data ?? {}) as Record<string, unknown>;
  const initial: SettingsValues = {
    name: (a.name as string) ?? "",
    description: (a.description as string) ?? "",
    logo_url: (a.logo_url as string) ?? "",
    hero_url: (a.hero_url as string) ?? "",
    email: (a.email as string) ?? "",
    phone: (a.phone as string) ?? "",
    website: (a.website as string) ?? "",
    region: (a.region as string) ?? "",
    city: (a.city as string) ?? "",
    address: (a.address as string) ?? "",
    lat: (a.lat as number) ?? null,
    lng: (a.lng as number) ?? null,
    facebook_url: (a.facebook_url as string) ?? "",
    instagram_url: (a.instagram_url as string) ?? "",
    is_published: Boolean(a.is_published),
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
          Nastavení útulku
        </h2>
        <p className="mt-1 text-ink-600">
          Tyto údaje se zobrazují na veřejném profilu útulku.
        </p>
      </div>

      <SettingsForm
        initial={initial}
        verificationStatus={institution.verification_status}
      />
    </div>
  );
}
