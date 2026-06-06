/**
 * Veřejná homepage — agregace publikovaných dat NAPŘÍČ všemi útulky.
 * Čte přes anon klienta (RLS pustí jen publikované). Žádná vymyšlená čísla.
 */
import { createClient } from "@/lib/supabase/server";
import { animalAgeLabel } from "@/lib/animal-age";
import type { AnimalCardData } from "@/components/zozio/animal-card";
import type { Species } from "@/types/database";

const NEW_DAYS = 14;

export interface NetworkStats {
  animalsAvailable: number;
  institutions: number;
  urgent: number;
  dogs: number;
  cats: number;
  longStay: number;
}

export interface NetworkInstitution {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  region: string | null;
  logoUrl: string | null;
  housingMode: "physical" | "foster_network" | "hybrid";
  availableCount: number;
}

export interface MagazineCard {
  id: string;
  title: string;
  href: string;
  coverUrl: string | null;
  source: { kind: "zozio" | "shelter" | "story"; label: string };
  meta: string;
  emoji: string;
}

export interface HomeData {
  stats: NetworkStats;
  animals: AnimalCardData[];
  institutions: NetworkInstitution[];
  magazine: MagazineCard[];
}

const HOUSING_LABEL: Record<NetworkInstitution["housingMode"], string> = {
  physical: "kamenný útulek",
  foster_network: "síť pěstounů",
  hybrid: "útulek + pěstouni",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric" });
}

export async function loadHomeData(): Promise<HomeData> {
  const supabase = await createClient();
  const newSince = new Date(Date.now() - NEW_DAYS * 86_400_000).toISOString();

  const availBase = () =>
    supabase
      .from("animals")
      .select("*", { count: "exact", head: true })
      .eq("adoption_status", "available")
      .eq("legal_status", "shelter_owned");

  const [
    { count: animalsAvailable },
    { count: institutionsCount },
    { count: urgentCount },
    { count: dogsCount },
    { count: catsCount },
    { count: longStayCount },
    featuredRes,
    institutionsRes,
    availableIdsRes,
    magazineRes,
    contentRes,
  ] = await Promise.all([
    availBase(),
    supabase
      .from("institutions")
      .select("*", { count: "exact", head: true })
      .eq("is_published", true),
    availBase().eq("is_urgent", true),
    availBase().eq("species", "dog"),
    availBase().eq("species", "cat"),
    availBase().eq("long_stay_boost", true),
    supabase
      .from("animals")
      .select(
        "id, name, species, breed, age_years, age_months, birth_date, primary_photo_url, adoption_status, is_urgent, long_stay_boost, personality_tags, created_at, institution:institutions!inner(name, slug, city, is_published)",
      )
      .eq("adoption_status", "available")
      .eq("legal_status", "shelter_owned")
      .eq("institutions.is_published", true)
      .order("is_urgent", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("institutions")
      .select("id, slug, name, city, region, logo_url, housing_mode")
      .eq("is_published", true),
    supabase
      .from("animals")
      .select("institution_id")
      .eq("adoption_status", "available")
      .eq("legal_status", "shelter_owned")
      .limit(2000),
    supabase
      .from("magazine_posts")
      .select("id, title, slug, cover_url, author, published_at, featured")
      .eq("status", "published")
      .order("featured", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(6),
    supabase
      .from("content_items")
      .select(
        "id, type, title, slug, cover_url, published_at, institution:institutions!inner(name, slug, is_published)",
      )
      .eq("status", "published")
      .eq("institutions.is_published", true)
      .order("published_at", { ascending: false })
      .limit(8),
  ]);

  // --- Zvířata (Hledají páníčka) ---
  type FeaturedRow = {
    id: string;
    name: string;
    species: Species;
    breed: string | null;
    age_years: number | null;
    age_months: number | null;
    birth_date: string | null;
    primary_photo_url: string | null;
    adoption_status: string;
    is_urgent: boolean;
    long_stay_boost: boolean;
    personality_tags: string[] | null;
    created_at: string;
    institution: { name: string; slug: string; city: string | null } | null;
  };
  const animals: AnimalCardData[] = ((featuredRes.data ?? []) as unknown as FeaturedRow[])
    .filter((a) => a.species === "dog" || a.species === "cat" || a.species === "other")
    .map((a) => ({
      id: a.id,
      name: a.name,
      species: a.species as "dog" | "cat" | "other",
      breed: a.breed ?? "—",
      ageLabel: animalAgeLabel(a),
      city: a.institution?.city ?? "",
      shelterName: a.institution?.name ?? "",
      photoUrl: a.primary_photo_url ?? "",
      status: "available",
      isUrgent: a.is_urgent,
      isLongStay: a.long_stay_boost,
      isNew: a.created_at >= newSince,
      tags: a.personality_tags ?? [],
    }));

  // --- Útulky v síti (s počty zvířat k adopci) ---
  const counts = new Map<string, number>();
  for (const row of (availableIdsRes.data ?? []) as { institution_id: string }[]) {
    counts.set(row.institution_id, (counts.get(row.institution_id) ?? 0) + 1);
  }
  type InstRow = {
    id: string;
    slug: string;
    name: string;
    city: string | null;
    region: string | null;
    logo_url: string | null;
    housing_mode: NetworkInstitution["housingMode"];
  };
  const institutions: NetworkInstitution[] = ((institutionsRes.data ?? []) as InstRow[])
    .map((i) => ({
      id: i.id,
      slug: i.slug,
      name: i.name,
      city: i.city,
      region: i.region,
      logoUrl: i.logo_url,
      housingMode: i.housing_mode,
      availableCount: counts.get(i.id) ?? 0,
    }))
    .sort((a, b) => b.availableCount - a.availableCount)
    .slice(0, 6);

  // --- Magazín: od Zozio (platform) + od útulků (content_items) ---
  type MagRow = {
    id: string;
    title: string;
    slug: string;
    cover_url: string | null;
    author: string;
    published_at: string | null;
    featured: boolean;
  };
  type ContentRow = {
    id: string;
    type: "article" | "story" | "event";
    title: string;
    slug: string;
    cover_url: string | null;
    published_at: string | null;
    institution: { name: string; slug: string } | null;
  };
  const zozioPosts: (MagazineCard & { _featured: boolean; _date: string })[] = (
    (magazineRes.data ?? []) as MagRow[]
  ).map((m) => ({
    id: `z-${m.id}`,
    title: m.title,
    href: `/magazin/${m.slug}`,
    coverUrl: m.cover_url,
    source: { kind: "zozio", label: "od Zozio" },
    meta: [m.author, m.published_at ? fmtDate(m.published_at) : ""].filter(Boolean).join(" · "),
    emoji: "📰",
    _featured: m.featured,
    _date: m.published_at ?? "",
  }));
  const typeEmoji: Record<ContentRow["type"], string> = {
    article: "📰",
    story: "🎉",
    event: "📅",
  };
  const typeMeta: Record<ContentRow["type"], string> = {
    article: "Novinka",
    story: "Příběh s dobrým koncem",
    event: "Akce · pozvánka",
  };
  const shelterPosts: (MagazineCard & { _featured: boolean; _date: string })[] = (
    (contentRes.data ?? []) as unknown as ContentRow[]
  )
    .filter((c) => c.institution)
    .map((c) => ({
      id: `c-${c.id}`,
      title: c.title,
      href: `/utulek/${c.institution!.slug}/clanek/${c.slug}`,
      coverUrl: c.cover_url,
      source:
        c.type === "story"
          ? ({ kind: "story", label: "Příběh" } as const)
          : ({ kind: "shelter", label: c.institution!.name } as const),
      meta: [
        c.type === "story" ? c.institution!.name : typeMeta[c.type],
        c.published_at ? fmtDate(c.published_at) : "",
      ]
        .filter(Boolean)
        .join(" · "),
      emoji: typeEmoji[c.type],
      _featured: false,
      _date: c.published_at ?? "",
    }));

  const magazine: MagazineCard[] = [...zozioPosts, ...shelterPosts]
    .sort((a, b) => {
      if (a._featured !== b._featured) return a._featured ? -1 : 1;
      return b._date.localeCompare(a._date);
    })
    .slice(0, 6)
    .map(({ _featured, _date, ...card }) => card);

  return {
    stats: {
      animalsAvailable: animalsAvailable ?? 0,
      institutions: institutionsCount ?? 0,
      urgent: urgentCount ?? 0,
      dogs: dogsCount ?? 0,
      cats: catsCount ?? 0,
      longStay: longStayCount ?? 0,
    },
    animals,
    institutions,
    magazine,
  };
}

export { HOUSING_LABEL };
