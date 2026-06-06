import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Globe,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
} from "lucide-react";

import { AnimalCard, type AnimalCardData } from "@/components/zozio/animal-card";
import { ZozioBadge } from "@/components/zozio/badge";
import { ZozioButton } from "@/components/zozio/button";
import { createClient } from "@/lib/supabase/server";
import { animalAgeLabel } from "@/lib/animal-age";
import { CATEGORY_LABEL } from "@/lib/content";
import type { AdoptionStatus, ContentType, Species } from "@/types/database";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const revalidate = 120;

interface InstitutionRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  hero_url: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  region: string | null;
  city: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  facebook_url: string | null;
  instagram_url: string | null;
  is_verified: boolean;
}

interface ContentCardRow {
  id: string;
  type: ContentType;
  title: string;
  slug: string;
  category: string | null;
  excerpt: string | null;
  cover_url: string | null;
  published_at: string | null;
  event_date: string | null;
  event_location: string | null;
}

interface AnimalListRow {
  id: string;
  name: string;
  species: Species;
  breed: string | null;
  age_years: number | null;
  age_months: number | null;
  primary_photo_url: string | null;
  adoption_status: AdoptionStatus;
  is_urgent: boolean;
  long_stay_boost: boolean;
  personality_tags: string[];
}

async function loadShelter(slug: string) {
  const supabase = await createClient();
  const { data: inst } = await supabase
    .from("institutions")
    .select(
      "id, slug, name, description, logo_url, hero_url, email, phone, website, region, city, address, lat, lng, facebook_url, instagram_url, is_verified",
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!inst) return null;

  const instId = (inst as unknown as InstitutionRow).id;

  const [{ data: animals, count }, { data: content }] = await Promise.all([
    supabase
      .from("animals")
      .select(
        "id, name, species, breed, age_years, age_months, birth_date, primary_photo_url, adoption_status, is_urgent, long_stay_boost, personality_tags",
        { count: "exact" },
      )
      .eq("institution_id", instId)
      .eq("adoption_status", "available")
      .neq("legal_status", "in_protection")
      .order("is_urgent", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("content_items")
      .select("id, type, title, slug, category, excerpt, cover_url, published_at, event_date, event_location")
      .eq("institution_id", instId)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(12),
  ]);

  return {
    inst: inst as unknown as InstitutionRow,
    animals: (animals ?? []) as unknown as AnimalListRow[],
    count: count ?? 0,
    content: (content ?? []) as unknown as ContentCardRow[],
  };
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const data = await loadShelter(slug);
  if (!data) return { title: "Útulek nenalezen — Zozio" };

  const { inst } = data;
  const title = `${inst.name} · Útulek na Zozio`;
  const description =
    inst.description?.slice(0, 160) ??
    `Profil útulku ${inst.name} a jejich zvířat k adopci.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: inst.hero_url ? [inst.hero_url] : inst.logo_url ? [inst.logo_url] : [],
      type: "profile",
    },
  };
}

export default async function ShelterPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await loadShelter(slug);
  if (!data) notFound();

  const { inst, animals, count, content } = data;

  const events = content.filter((c) => c.type === "event");
  const posts = content.filter((c) => c.type !== "event");

  const cards: AnimalCardData[] = animals
    .filter((a) => a.species === "dog" || a.species === "cat" || a.species === "other")
    .map((a) => ({
      id: a.id,
      name: a.name,
      species: a.species as "dog" | "cat" | "other",
      breed: a.breed ?? "—",
      ageLabel: animalAgeLabel(a),
      city: inst.city ?? "",
      shelterName: inst.name,
      photoUrl: a.primary_photo_url ?? "",
      status: a.adoption_status as "available" | "reserved" | "adopted",
      isUrgent: a.is_urgent,
      isLongStay: a.long_stay_boost,
      tags: a.personality_tags ?? [],
    }));

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AnimalShelter",
    name: inst.name,
    description: inst.description,
    url: `https://zozio.cz/utulek/${inst.slug}`,
    address: inst.address
      ? {
          "@type": "PostalAddress",
          streetAddress: inst.address,
          addressLocality: inst.city,
          addressRegion: inst.region,
          addressCountry: "CZ",
        }
      : undefined,
    geo:
      inst.lat && inst.lng
        ? { "@type": "GeoCoordinates", latitude: inst.lat, longitude: inst.lng }
        : undefined,
    telephone: inst.phone,
    email: inst.email,
    sameAs: [inst.website, inst.facebook_url, inst.instagram_url].filter(Boolean),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Back link */}
      <div className="border-b border-ink-900/8 bg-cream-warm">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <Link
            href="/utulky"
            className="inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-meadow-700"
          >
            <ChevronLeft className="size-4" /> Všechny útulky
          </Link>
        </div>
      </div>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-cream via-cream-warm to-sage-100/40">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-[1fr_2fr] lg:items-center">
          <div className="aspect-square overflow-hidden rounded-3xl bg-cream shadow-soft-md ring-1 ring-ink-900/8">
            {inst.hero_url || inst.logo_url ? (
              <div className="relative size-full">
                <Image
                  src={inst.hero_url ?? inst.logo_url!}
                  alt={inst.name}
                  fill
                  sizes="(min-width: 1024px) 33vw, 100vw"
                  className="object-cover"
                  priority
                />
              </div>
            ) : (
              <div className="flex size-full items-center justify-center bg-sage-100 text-7xl">
                🏡
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <ZozioBadge variant="soft">Útulek</ZozioBadge>
              {inst.is_verified && (
                <ZozioBadge variant="available">
                  <ShieldCheck className="size-3.5" /> Ověřeno
                </ZozioBadge>
              )}
            </div>

            <h1 className="font-display text-4xl font-bold leading-[1] tracking-tight text-ink-900 md:text-6xl">
              {inst.name}
            </h1>

            {(inst.city || inst.region) && (
              <p className="inline-flex items-center gap-1.5 text-lg text-ink-600">
                <MapPin className="size-5" />
                {[inst.city, inst.region]
                  .filter((x) => x && x !== inst.city)
                  .concat(inst.city ?? "")
                  .filter(Boolean)
                  .slice(0, 2)
                  .join(", ")}
              </p>
            )}

            {inst.description && (
              <p className="max-w-2xl text-base leading-relaxed text-ink-700">
                {inst.description}
              </p>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              <ZozioButton asChild variant="meadow" size="lg">
                <Link href={`/adopt?shelter=${inst.id}`}>
                  Zobrazit zvířata ({count})
                </Link>
              </ZozioButton>
              {inst.website && (
                <ZozioButton asChild variant="outline" size="lg">
                  <a
                    href={inst.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Globe /> Web útulku
                  </a>
                </ZozioButton>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
          {/* Animals list */}
          <div className="min-w-0">
            <header className="mb-8 flex items-end justify-between gap-6">
              <div className="space-y-1">
                <div className="font-mono text-xs uppercase tracking-wider text-meadow-700">
                  Hledá nový domov
                </div>
                <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900 md:text-4xl">
                  Zvířata v péči
                </h2>
              </div>
              {count > 0 && (
                <Link
                  href={`/adopt?shelter=${inst.id}`}
                  className="hidden text-sm font-semibold text-meadow-700 hover:text-meadow-600 md:inline"
                >
                  Filtrovat v katalogu →
                </Link>
              )}
            </header>

            {cards.length === 0 ? (
              <div className="rounded-3xl bg-cream-warm p-12 text-center text-ink-600">
                <div className="text-4xl">🐾</div>
                <p className="mt-3">
                  Tento útulek momentálně nemá zveřejněná žádná zvířata.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {cards.map((c) => (
                  <AnimalCard key={c.id} animal={c} />
                ))}
              </div>
            )}

            {events.length > 0 && (
              <section className="mt-14">
                <h2 className="mb-6 font-display text-3xl font-bold tracking-tight text-ink-900">
                  Nadcházející akce
                </h2>
                <div className="space-y-3">
                  {events.map((e) => {
                    const d = e.event_date ? new Date(e.event_date) : null;
                    return (
                      <Link
                        key={e.id}
                        href={`/utulek/${inst.slug}/clanek/${e.slug}`}
                        className="flex items-center gap-4 rounded-3xl bg-cream p-4 ring-1 ring-ink-900/8 transition hover:shadow-soft-md"
                      >
                        <div className="flex size-16 shrink-0 flex-col items-center justify-center rounded-2xl bg-meadow-50 text-meadow-700">
                          <span className="font-display text-2xl font-bold leading-none">
                            {d ? d.getDate() : "–"}
                          </span>
                          <span className="text-xs font-bold uppercase">
                            {d
                              ? d.toLocaleDateString("cs-CZ", { month: "short" }).replace(".", "")
                              : ""}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-display text-lg font-bold text-ink-900">{e.title}</div>
                          {e.event_location && (
                            <div className="mt-0.5 text-sm text-ink-500">📍 {e.event_location}</div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {posts.length > 0 && (
              <section className="mt-14">
                <h2 className="mb-6 font-display text-3xl font-bold tracking-tight text-ink-900">
                  Novinky a příběhy
                </h2>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {posts.map((p) => {
                    const cat = p.category ?? "news";
                    return (
                      <Link
                        key={p.id}
                        href={`/utulek/${inst.slug}/clanek/${p.slug}`}
                        className="group overflow-hidden rounded-3xl bg-cream ring-1 ring-ink-900/8 transition hover:shadow-soft-md"
                      >
                        <div className="relative aspect-[16/9] bg-sage-100">
                          {p.cover_url ? (
                            <Image
                              src={p.cover_url}
                              alt={p.title}
                              fill
                              sizes="(min-width: 640px) 50vw, 100vw"
                              className="object-cover transition group-hover:scale-[1.03]"
                            />
                          ) : (
                            <div className="flex size-full items-center justify-center text-4xl">
                              {p.type === "story" ? "🎉" : "📰"}
                            </div>
                          )}
                        </div>
                        <div className="p-5">
                          <div className="flex items-center gap-2 text-xs font-semibold text-meadow-700">
                            <span>{CATEGORY_LABEL[cat] ?? cat}</span>
                            {p.published_at && (
                              <span className="text-ink-400">
                                · {new Date(p.published_at).toLocaleDateString("cs-CZ")}
                              </span>
                            )}
                          </div>
                          <h3 className="mt-1.5 font-display text-xl font-bold leading-snug text-ink-900">
                            {p.title}
                          </h3>
                          {p.excerpt && (
                            <p className="mt-2 line-clamp-2 text-sm text-ink-600">{p.excerpt}</p>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar: contact */}
          <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
            <div className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
              <h3 className="font-display text-xl font-bold text-ink-900">
                Kontakt
              </h3>
              <ul className="mt-4 space-y-3 text-sm">
                {inst.address && (
                  <li className="flex items-start gap-2.5">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-ink-400" />
                    <span className="text-ink-700">{inst.address}</span>
                  </li>
                )}
                {inst.email && (
                  <li className="flex items-start gap-2.5">
                    <Mail className="mt-0.5 size-4 shrink-0 text-ink-400" />
                    <a
                      href={`mailto:${inst.email}`}
                      className="break-all text-ink-700 hover:text-meadow-700"
                    >
                      {inst.email}
                    </a>
                  </li>
                )}
                {inst.phone && (
                  <li className="flex items-start gap-2.5">
                    <Phone className="mt-0.5 size-4 shrink-0 text-ink-400" />
                    <a
                      href={`tel:${inst.phone.replace(/\s/g, "")}`}
                      className="text-ink-700 hover:text-meadow-700"
                    >
                      {inst.phone}
                    </a>
                  </li>
                )}
                {inst.website && (
                  <li className="flex items-start gap-2.5">
                    <Globe className="mt-0.5 size-4 shrink-0 text-ink-400" />
                    <a
                      href={inst.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="break-all text-ink-700 hover:text-meadow-700"
                    >
                      {new URL(inst.website).host}
                    </a>
                  </li>
                )}
              </ul>
            </div>

            {inst.lat && inst.lng && (
              <a
                href={`https://mapy.cz/zakladni?x=${inst.lng}&y=${inst.lat}&z=15`}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-3xl bg-sage-100 p-6 ring-1 ring-ink-900/8 transition hover:bg-sage-100/80"
              >
                <div className="flex items-center gap-2 text-sage-700">
                  <MapPin className="size-5" />
                  <span className="font-semibold">Otevřít v Mapy.cz</span>
                </div>
                <p className="mt-2 text-xs text-ink-600">
                  {inst.lat.toFixed(4)}°N, {inst.lng.toFixed(4)}°E
                </p>
              </a>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
