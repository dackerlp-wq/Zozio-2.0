import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  Clock,
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
  founded_year: number | null;
  opening_hours: string | null;
  darujme_org_id: string | null;
  bank_account: string | null;
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
      "id, slug, name, description, logo_url, hero_url, email, phone, website, region, city, address, lat, lng, facebook_url, instagram_url, is_verified, founded_year, opening_hours, darujme_org_id, bank_account",
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!inst) return null;

  const instId = (inst as unknown as InstitutionRow).id;

  const [
    { data: animals, count },
    { data: content },
    { count: urgentCount },
    { count: adoptedCount },
  ] = await Promise.all([
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
    supabase
      .from("animals")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", instId)
      .eq("adoption_status", "available")
      .eq("is_urgent", true)
      .neq("legal_status", "in_protection"),
    supabase
      .from("animals")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", instId)
      .eq("adoption_status", "adopted"),
  ]);

  return {
    inst: inst as unknown as InstitutionRow,
    animals: (animals ?? []) as unknown as AnimalListRow[],
    count: count ?? 0,
    urgentCount: urgentCount ?? 0,
    adoptedCount: adoptedCount ?? 0,
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

  const { inst, animals, count, urgentCount, adoptedCount, content } = data;

  const events = content.filter((c) => c.type === "event");
  const posts = content.filter((c) => c.type !== "event");

  const yearsHelping =
    inst.founded_year && inst.founded_year >= 1800
      ? new Date().getFullYear() - inst.founded_year
      : null;

  // „Podpoř útulek": darujme.cz dle org ID, jinak bankovní účet, jinak skryto.
  const darujmeUrl = inst.darujme_org_id
    ? `https://www.darujme.cz/organizace/${inst.darujme_org_id}`
    : null;
  const canSupport = Boolean(darujmeUrl || inst.bank_account);

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

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 md:py-8">
        {/* Back link */}
        <Link
          href="/utulky"
          className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-terracotta-600"
        >
          <ChevronLeft className="size-4" /> Všechny útulky
        </Link>

        {/* Hero karta */}
        <section className="flex flex-wrap items-start gap-6 rounded-3xl bg-gradient-to-br from-cream via-cream-warm to-peach-100/50 p-6 ring-1 ring-ink-900/8 sm:p-8">
          <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl bg-card ring-1 ring-ink-900/8">
            {inst.logo_url ? (
              <Image
                src={inst.logo_url}
                alt={inst.name}
                width={96}
                height={96}
                className="size-full object-cover"
                priority
              />
            ) : (
              <span className="text-5xl">🏡</span>
            )}
          </div>

          <div className="min-w-[240px] flex-1">
            {inst.is_verified && (
              <ZozioBadge variant="fresh">
                <ShieldCheck className="size-3.5" /> Ověřený útulek
              </ZozioBadge>
            )}

            <h1 className="mt-2 font-display text-3xl font-bold leading-[1.05] tracking-tight text-ink-900 md:text-4xl">
              {inst.name}
            </h1>

            {(inst.city || inst.region || inst.founded_year) && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 font-semibold text-ink-600">
                <MapPin className="size-4" />
                {[
                  [inst.city, inst.region]
                    .filter((x) => x && x !== inst.city)
                    .concat(inst.city ?? "")
                    .filter(Boolean)
                    .slice(0, 2)
                    .join(", "),
                  inst.founded_year ? `od roku ${inst.founded_year}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}

            {inst.description && (
              <p className="mt-3 max-w-xl leading-relaxed text-ink-700">
                {inst.description}
              </p>
            )}

            <div className="mt-5 flex flex-wrap gap-2.5">
              <ZozioButton asChild variant="meadow">
                <Link href={`/adopt?shelter=${inst.id}`}>
                  🐾 Zobrazit zvířata ({count})
                </Link>
              </ZozioButton>
              {canSupport && (
                <ZozioButton asChild variant="sunshine">
                  <a href="#podpora">💛 Podpořit útulek</a>
                </ZozioButton>
              )}
              {inst.website && (
                <ZozioButton asChild variant="outline">
                  <a href={inst.website} target="_blank" rel="noopener noreferrer">
                    <Globe /> Web útulku
                  </a>
                </ZozioButton>
              )}
            </div>
          </div>
        </section>

        {/* Statistiky */}
        <div className="mt-4 grid grid-cols-2 gap-3.5 md:grid-cols-4">
          <StatCard value={count.toLocaleString("cs-CZ")} label="Zvířat k adopci" />
          <StatCard value={urgentCount.toLocaleString("cs-CZ")} label="Naléhavých" />
          <StatCard value={adoptedCount.toLocaleString("cs-CZ")} label="Adoptováno přes Zozio" />
          {yearsHelping != null ? (
            <StatCard value={`${yearsHelping} let`} label="Pomáháme" />
          ) : (
            <StatCard value="❤️" label="Pomáháme zvířatům" />
          )}
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* Animals list */}
          <div className="min-w-0">
            <div className="flex items-baseline gap-3">
              <h2 className="font-display text-2xl font-bold tracking-tight text-ink-900 md:text-3xl">
                Zvířata v péči
              </h2>
              {count > 0 && (
                <Link
                  href={`/adopt?shelter=${inst.id}`}
                  className="ml-auto text-sm font-bold text-terracotta-600 hover:text-terracotta-700"
                >
                  Filtrovat v katalogu →
                </Link>
              )}
            </div>
            <p className="mb-5 mt-0.5 text-sm font-semibold text-ink-500">Hledají nový domov.</p>

            {cards.length === 0 ? (
              <div className="rounded-3xl bg-cream-warm p-12 text-center text-ink-600">
                <div className="text-4xl">🐾</div>
                <p className="mt-3">
                  Tento útulek momentálně nemá zveřejněná žádná zvířata.
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
                  {cards.slice(0, 6).map((c) => (
                    <AnimalCard key={c.id} animal={c} />
                  ))}
                </div>
                {count > 6 && (
                  <Link
                    href={`/adopt?shelter=${inst.id}`}
                    className="mt-4 block rounded-pill bg-card py-3 text-center text-sm font-bold text-ink-700 ring-1 ring-ink-900/12 transition hover:ring-ink-900/25"
                  >
                    Zobrazit všech {count} zvířat →
                  </Link>
                )}
              </>
            )}

            {events.length > 0 && (
              <section className="mt-10">
                <h2 className="font-display text-2xl font-bold tracking-tight text-ink-900 md:text-3xl">
                  Nadcházející akce
                </h2>
                <p className="mb-4 mt-0.5 text-sm font-semibold text-ink-500">Přijď nás podpořit.</p>
                <div className="space-y-3">
                  {events.map((e) => {
                    const d = e.event_date ? new Date(e.event_date) : null;
                    return (
                      <Link
                        key={e.id}
                        href={`/utulek/${inst.slug}/clanek/${e.slug}`}
                        className="flex items-center gap-3.5 rounded-3xl bg-card p-3.5 ring-1 ring-ink-900/8 transition hover:shadow-soft-md"
                      >
                        <div className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-meadow-50 text-meadow-700">
                          <span className="font-display text-xl font-bold leading-none">
                            {d ? d.getDate() : "–"}
                          </span>
                          <span className="text-[11px] font-bold uppercase">
                            {d
                              ? d.toLocaleDateString("cs-CZ", { month: "short" }).replace(".", "")
                              : ""}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="font-display text-base font-bold text-ink-900">{e.title}</div>
                          {e.event_location && (
                            <div className="mt-0.5 text-[13px] text-ink-500">📍 {e.event_location}</div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}

            {posts.length > 0 && (
              <section className="mt-10">
                <h2 className="font-display text-2xl font-bold tracking-tight text-ink-900 md:text-3xl">
                  Novinky a příběhy
                </h2>
                <p className="mb-4 mt-0.5 text-sm font-semibold text-ink-500">Co se v útulku děje.</p>
                <div className="space-y-3">
                  {posts.map((p) => {
                    const cat = p.category ?? "news";
                    return (
                      <Link
                        key={p.id}
                        href={`/utulek/${inst.slug}/clanek/${p.slug}`}
                        className="flex items-center gap-3.5 rounded-3xl bg-card p-3.5 ring-1 ring-ink-900/8 transition hover:shadow-soft-md"
                      >
                        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-cream-warm text-2xl">
                          {p.cover_url ? (
                            <Image
                              src={p.cover_url}
                              alt={p.title}
                              width={56}
                              height={56}
                              className="size-full object-cover"
                            />
                          ) : p.type === "story" ? (
                            "🎉"
                          ) : (
                            "📰"
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-display text-base font-bold text-ink-900">
                            {p.title}
                          </div>
                          <div className="mt-0.5 text-[13px] font-semibold text-ink-500">
                            {CATEGORY_LABEL[cat] ?? cat}
                            {p.published_at && (
                              <> · {new Date(p.published_at).toLocaleDateString("cs-CZ")}</>
                            )}
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          {/* Sidebar: support + contact */}
          <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
            {canSupport && (
              <div
                id="podpora"
                className="scroll-mt-24 rounded-3xl bg-gradient-to-br from-sunshine-100 to-cream p-6 ring-1 ring-sunshine-400/40"
              >
                <h3 className="font-display text-xl font-bold text-ink-900">
                  💛 Podpoř útulek
                </h3>
                <p className="mt-2 text-sm text-ink-600">
                  Přispěj na krmení a veterinu. Peníze jdou přímo útulku — Zozio si nebere nic.
                </p>
                {darujmeUrl ? (
                  <ZozioButton asChild variant="sunshine" className="mt-4 w-full">
                    <a href={darujmeUrl} target="_blank" rel="noopener noreferrer">
                      Přispět přes Darujme.cz
                    </a>
                  </ZozioButton>
                ) : (
                  inst.bank_account && (
                    <div className="mt-4 rounded-2xl bg-card p-3.5 ring-1 ring-ink-900/8">
                      <div className="text-xs font-bold text-ink-400">Číslo účtu</div>
                      <div className="font-display text-lg font-bold tracking-tight text-ink-900">
                        {inst.bank_account}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}

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
                {inst.opening_hours && (
                  <li className="flex items-start gap-2.5">
                    <Clock className="mt-0.5 size-4 shrink-0 text-ink-400" />
                    <span className="whitespace-pre-line text-ink-700">{inst.opening_hours}</span>
                  </li>
                )}
              </ul>

              {inst.lat && inst.lng && (
                <a
                  href={`https://mapy.cz/zakladni?x=${inst.lng}&y=${inst.lat}&z=15`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative mt-4 block h-36 overflow-hidden rounded-2xl bg-cream-warm ring-1 ring-ink-900/8"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle, rgba(44,24,16,0.07) 1.2px, transparent 1.3px)",
                    backgroundSize: "16px 16px",
                  }}
                >
                  <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-[60%] text-3xl">
                    📍
                  </span>
                  <span className="absolute bottom-2 right-2 rounded-pill bg-card px-2.5 py-1 text-[11px] font-bold text-terracotta-600 ring-1 ring-ink-900/8">
                    Otevřít v Mapy.cz ↗
                  </span>
                </a>
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-3xl bg-card p-5 ring-1 ring-ink-900/8 shadow-soft-sm">
      <div className="font-display text-2xl font-bold text-terracotta-600 md:text-3xl">{value}</div>
      <div className="mt-1 text-[13px] font-semibold text-ink-500">{label}</div>
    </div>
  );
}
