import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, ChevronLeft, MapPin } from "lucide-react";

import { ZozioBadge } from "@/components/zozio/badge";
import { createClient } from "@/lib/supabase/server";
import { sanitizeHtml } from "@/lib/sanitize";
import { CATEGORY_LABEL } from "@/lib/content";
import type { ContentType } from "@/types/database";

import { ContentViewTracker } from "./view-tracker";

interface PageProps {
  params: Promise<{ slug: string; clanek: string }>;
}

export const revalidate = 120;

interface ContentRow {
  id: string;
  type: ContentType;
  title: string;
  slug: string;
  category: string | null;
  excerpt: string | null;
  body: string | null;
  cover_url: string | null;
  published_at: string | null;
  event_date: string | null;
  event_location: string | null;
}

async function load(slug: string, clanek: string) {
  const supabase = await createClient();
  const { data: inst } = await supabase
    .from("institutions")
    .select("id, slug, name")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!inst) return null;
  const institution = inst as { id: string; slug: string; name: string };

  const { data: item } = await supabase
    .from("content_items")
    .select(
      "id, type, title, slug, category, excerpt, body, cover_url, published_at, event_date, event_location",
    )
    .eq("institution_id", institution.id)
    .eq("slug", clanek)
    .eq("status", "published")
    .maybeSingle();
  if (!item) return null;

  return { institution, item: item as unknown as ContentRow };
}

export async function generateMetadata({ params }: PageProps) {
  const { slug, clanek } = await params;
  const data = await load(slug, clanek);
  if (!data) return { title: "Článek nenalezen — Zozio" };
  const { item, institution } = data;
  const description = item.excerpt ?? `${item.title} — ${institution.name}`;
  return {
    title: `${item.title} · ${institution.name}`,
    description,
    openGraph: {
      title: item.title,
      description,
      images: item.cover_url ? [item.cover_url] : [],
      type: "article",
    },
  };
}

export default async function ContentDetailPage({ params }: PageProps) {
  const { slug, clanek } = await params;
  const data = await load(slug, clanek);
  if (!data) notFound();
  const { item, institution } = data;

  const cat = item.category ?? "news";
  const safeBody = item.body ? sanitizeHtml(item.body) : "";

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <ContentViewTracker contentId={item.id} />

      <Link
        href={`/utulek/${institution.slug}`}
        className="inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-meadow-700"
      >
        <ChevronLeft className="size-4" /> {institution.name}
      </Link>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-sm text-ink-500">
        <ZozioBadge variant="soft">{CATEGORY_LABEL[cat] ?? cat}</ZozioBadge>
        {item.published_at && (
          <span>
            {new Date(item.published_at).toLocaleDateString("cs-CZ", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </span>
        )}
      </div>

      <h1 className="mt-3 font-display text-4xl font-bold leading-tight tracking-tight text-ink-900">
        {item.title}
      </h1>

      {item.excerpt && <p className="mt-3 text-lg text-ink-600">{item.excerpt}</p>}

      {(item.event_date || item.event_location) && (
        <div className="mt-5 flex flex-wrap gap-4 rounded-2xl bg-cream-warm px-5 py-4 text-sm font-semibold text-ink-700">
          {item.event_date && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="size-4 text-meadow-700" />
              {new Date(item.event_date).toLocaleDateString("cs-CZ", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          )}
          {item.event_location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4 text-meadow-700" />
              {item.event_location}
            </span>
          )}
        </div>
      )}

      {item.cover_url && (
        <div className="relative mt-6 aspect-[16/9] overflow-hidden rounded-3xl bg-cream ring-1 ring-ink-900/8">
          <Image
            src={item.cover_url}
            alt={item.title}
            fill
            sizes="(min-width: 768px) 768px, 100vw"
            className="object-cover"
            priority
          />
        </div>
      )}

      {safeBody && (
        <div
          className="mt-8 space-y-4 text-[17px] leading-relaxed text-ink-700 [&_a]:font-semibold [&_a]:text-meadow-700 [&_a]:underline [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-ink-900 [&_h3]:mt-6 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-ink-900 [&_img]:rounded-2xl [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_strong]:font-bold [&_ul]:space-y-1"
          dangerouslySetInnerHTML={{ __html: safeBody }}
        />
      )}
    </article>
  );
}
