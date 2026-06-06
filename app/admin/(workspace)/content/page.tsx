import { redirect } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { canView } from "@/lib/permissions";
import { createServiceClient } from "@/lib/supabase/service";
import { DEFAULT_WIDGET, type WidgetConfig } from "@/lib/content";
import { SITE_URL } from "@/lib/email/config";
import type {
  ContentItemRow,
  NewsletterCampaignRow,
  NewsletterSegment,
} from "@/types/database";

import {
  ContentManager,
  type CampaignVM,
  type ContentVM,
} from "./content-manager";

export const metadata = { title: "Web & obsah — Zozio Admin" };

const PAID = ["standard", "pro"];

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function ContentPage({ searchParams }: PageProps) {
  const { institutionId, role, institution } = await requireMembership();
  if (!canView(role, "web")) redirect("/admin/dashboard");

  const service = createServiceClient();
  const { data: inst } = await service
    .from("institutions")
    .select("plan, slug, widget_config")
    .eq("id", institutionId)
    .maybeSingle();
  const instRow = inst as { plan: string; slug: string; widget_config: WidgetConfig | null } | null;
  const plan = instRow?.plan ?? "free";

  if (!PAID.includes(plan)) {
    return (
      <div className="mx-auto max-w-2xl">
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">Web & obsah</h2>
        <div className="mt-6 rounded-3xl bg-cream p-10 text-center ring-1 ring-ink-900/8">
          <div className="text-4xl">🌐</div>
          <p className="mt-3 font-display text-lg font-bold text-ink-900">Web & obsah je v tarifu Profi+</p>
          <p className="mt-1 text-sm text-ink-500">
            Články, příběhy, akce, newsletter a embed widget pro váš web.
          </p>
        </div>
      </div>
    );
  }

  const tab = await searchParams;

  const [
    { data: contentData },
    { data: campaignData },
    { data: animalData },
    { data: allAnimalData },
    subStats,
  ] = await Promise.all([
      service
        .from("content_items")
        .select("id, type, title, slug, category, excerpt, body, cover_url, status, published_at, updated_at, view_count, animal_id, event_date, event_location")
        .eq("institution_id", institutionId)
        .order("updated_at", { ascending: false }),
      service
        .from("newsletter_campaigns")
        .select("id, subject, segment, status, scheduled_at, sent_at, recipients, opens, created_at")
        .eq("institution_id", institutionId)
        .order("created_at", { ascending: false }),
      service
        .from("animals")
        .select("id, name, primary_photo_url")
        .eq("institution_id", institutionId)
        .eq("adoption_status", "adopted")
        .order("name", { ascending: true }),
      service
        .from("animals")
        .select("id, name, species, adoption_status, primary_photo_url")
        .eq("institution_id", institutionId)
        .order("name", { ascending: true }),
      service
        .from("newsletter_subscribers")
        .select("segment, unsubscribed_at")
        .eq("institution_id", institutionId),
    ]);

  const content = (contentData ?? []) as unknown as ContentVM[];
  const campaigns = ((campaignData ?? []) as NewsletterCampaignRow[]).map((c) => ({
    id: c.id,
    subject: c.subject,
    segment: c.segment,
    status: c.status,
    scheduledAt: c.scheduled_at,
    sentAt: c.sent_at,
    recipients: c.recipients,
    opens: c.opens,
  })) as CampaignVM[];

  const animals = (animalData ?? []) as { id: string; name: string; primary_photo_url: string | null }[];
  const allAnimals = (allAnimalData ?? []) as {
    id: string;
    name: string;
    species: string;
    adoption_status: string;
    primary_photo_url: string | null;
  }[];

  // Statistiky odběratelů.
  const subs = (subStats.data ?? []) as { segment: NewsletterSegment; unsubscribed_at: string | null }[];
  const active = subs.filter((s) => !s.unsubscribed_at);
  const segmentCounts: Record<string, number> = { all: active.length, donor: 0, adopter: 0, supporter: 0 };
  for (const s of active) segmentCounts[s.segment] = (segmentCounts[s.segment] ?? 0) + 1;

  const sentCampaigns = campaigns.filter((c) => c.status === "sent");
  const avgOpenRate =
    sentCampaigns.length > 0
      ? Math.round(
          (sentCampaigns.reduce((acc, c) => acc + (c.recipients ? c.opens / c.recipients : 0), 0) /
            sentCampaigns.length) *
            100,
        )
      : null;
  const campaignsThisYear = campaigns.filter(
    (c) => c.sentAt && new Date(c.sentAt).getFullYear() === new Date().getFullYear(),
  ).length;

  return (
    <ContentManager
      initialTab={tab.tab}
      content={content}
      campaigns={campaigns}
      adoptedAnimals={animals}
      taggableAnimals={allAnimals}
      institutionId={institutionId}
      institutionName={institution.name}
      slug={instRow?.slug ?? institution.slug}
      baseUrl={SITE_URL}
      widgetConfig={instRow?.widget_config ?? DEFAULT_WIDGET}
      newsletter={{
        subscribers: active.length,
        avgOpenRate,
        campaignsThisYear,
        segmentCounts,
      }}
    />
  );
}
