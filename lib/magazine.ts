import { createClient } from "@/lib/supabase/server";
import { animalAgeLabel } from "@/lib/animal-age";
import { scoreAdopterMatch, type AdopterPreferences, type MatchAnimal } from "@/lib/matching";
import type {
  AdoptionStatus,
  AnimalSize,
  AdopterExperience,
  CareDifficulty,
  Compatibility,
  ContentType,
  EnergyLevel,
  HealthStatus,
  Species,
  SuitableHousing,
} from "@/types/database";

export type MagazineSource = "shelter" | "zozio";
export type MagazineKind = "story" | "event" | "news" | "guide";

export interface MagazineEntry {
  source: MagazineSource;
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  kind: MagazineKind;
  publishedAt: string | null;
  readingMinutes: number | null;
  sourceLabel: string;
  authorLabel: string;
  href: string;
  featured: boolean;
}

export const MAGAZINE_TABS: { key: string; label: string }[] = [
  { key: "all", label: "Vše" },
  { key: "story", label: "Příběhy 🎉" },
  { key: "guide", label: "Rady & návody" },
  { key: "news", label: "Novinky" },
  { key: "event", label: "Akce" },
  { key: "zozio", label: "od Zozio" },
];

export const KIND_LABEL: Record<MagazineKind, string> = {
  story: "Příběh",
  event: "Akce",
  news: "Novinka",
  guide: "Rady & návody",
};

/** Štítek zdroje: barevné rozlišení od Zozio / útulek / Příběh / Akce. */
export function sourceTagClass(entry: Pick<MagazineEntry, "source" | "kind">): string {
  if (entry.source === "zozio") return "bg-ink-900 text-cream";
  if (entry.kind === "story") return "bg-fern-100 text-fern-700";
  if (entry.kind === "event") return "bg-sunshine-200 text-sunshine-600";
  return "bg-peach-200 text-terracotta-600";
}

export function readingMinutes(body: string | null): number | null {
  if (!body) return null;
  const text = body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  const words = text.split(" ").length;
  return Math.max(1, Math.round(words / 200));
}

function magazineKindFromCategory(category: string | null): MagazineKind {
  const c = (category ?? "").toLowerCase();
  if (c.includes("story") || c.includes("příběh") || c.includes("pribeh")) return "story";
  if (c.includes("event") || c.includes("akce")) return "event";
  if (c.includes("guide") || c.includes("rada") || c.includes("rády") || c.includes("návod") || c.includes("navod")) return "guide";
  return "news";
}

function contentKind(type: ContentType, category: string | null): MagazineKind {
  if (type === "story") return "story";
  if (type === "event") return "event";
  const c = (category ?? "").toLowerCase();
  if (c.includes("guide") || c.includes("rada") || c.includes("návod") || c.includes("navod")) return "guide";
  return "news";
}

type ContentFeedRow = {
  id: string;
  type: ContentType;
  title: string;
  slug: string;
  category: string | null;
  excerpt: string | null;
  body: string | null;
  cover_url: string | null;
  published_at: string | null;
  featured?: boolean | null;
  institution: { slug: string; name: string; is_published: boolean } | null;
};

type MagazinePostFeedRow = {
  id: string;
  title: string;
  slug: string;
  category: string;
  excerpt: string | null;
  body: string | null;
  cover_url: string | null;
  author: string;
  featured: boolean;
  published_at: string | null;
};

/** Načte a normalizuje všechny publikované články (útulky + Zozio), seřazené dle data. */
async function loadAllEntries(): Promise<MagazineEntry[]> {
  const supabase = await createClient();

  const [{ data: content }, { data: zozio }] = await Promise.all([
    supabase
      .from("content_items")
      .select(
        "id, type, title, slug, category, excerpt, body, cover_url, published_at, institution:institutions!inner(slug, name, is_published)",
      )
      .eq("status", "published")
      .eq("institutions.is_published", true)
      .order("published_at", { ascending: false })
      .limit(60),
    supabase
      .from("magazine_posts")
      .select("id, title, slug, category, excerpt, body, cover_url, author, featured, published_at")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(60),
  ]);

  const shelterEntries: MagazineEntry[] = ((content ?? []) as unknown as ContentFeedRow[])
    .filter((c) => c.institution)
    .map((c) => ({
      source: "shelter" as const,
      id: c.id,
      slug: c.slug,
      title: c.title,
      excerpt: c.excerpt,
      coverUrl: c.cover_url,
      kind: contentKind(c.type, c.category),
      publishedAt: c.published_at,
      readingMinutes: readingMinutes(c.body),
      sourceLabel: c.institution!.name,
      authorLabel: c.institution!.name,
      href: `/utulek/${c.institution!.slug}/clanek/${c.slug}`,
      featured: false,
    }));

  const zozioEntries: MagazineEntry[] = ((zozio ?? []) as unknown as MagazinePostFeedRow[]).map((m) => ({
    source: "zozio" as const,
    id: m.id,
    slug: m.slug,
    title: m.title,
    excerpt: m.excerpt,
    coverUrl: m.cover_url,
    kind: magazineKindFromCategory(m.category),
    publishedAt: m.published_at,
    readingMinutes: readingMinutes(m.body),
    sourceLabel: "od Zozio",
    authorLabel: m.author || "Redakce Zozio",
    href: `/magazin/${m.slug}`,
    featured: m.featured,
  }));

  return [...shelterEntries, ...zozioEntries].sort((a, b) => {
    const da = a.publishedAt ? Date.parse(a.publishedAt) : 0;
    const db = b.publishedAt ? Date.parse(b.publishedAt) : 0;
    return db - da;
  });
}

/** Sloučený feed: publikované články útulků + platform „od Zozio". */
export async function loadMagazineFeed(category: string): Promise<{
  featured: MagazineEntry | null;
  entries: MagazineEntry[];
}> {
  let all = await loadAllEntries();

  // Featured: kurátorský od Zozio, jinak nejnovější.
  const featured = all.find((e) => e.source === "zozio" && e.featured) ?? all[0] ?? null;

  // Filtr kategorie/zdroje.
  if (category && category !== "all") {
    if (category === "zozio") all = all.filter((e) => e.source === "zozio");
    else all = all.filter((e) => e.kind === category);
  }

  const entries = all.filter((e) => !(featured && e.source === featured.source && e.id === featured.id));

  return { featured: category === "all" ? featured : null, entries };
}

/** Články, kde je navázané dané zvíře („Píše se o mně" na detailu zvířete). */
export async function loadArticlesAboutAnimal(animalId: string): Promise<MagazineEntry[]> {
  const supabase = await createClient();
  const { data: links } = await supabase
    .from("article_animals")
    .select("content_item_id, magazine_post_id")
    .eq("animal_id", animalId);

  const rows = (links ?? []) as { content_item_id: string | null; magazine_post_id: string | null }[];
  if (rows.length === 0) return [];
  const ciIds = new Set(rows.map((r) => r.content_item_id).filter(Boolean) as string[]);
  const mpIds = new Set(rows.map((r) => r.magazine_post_id).filter(Boolean) as string[]);

  const all = await loadAllEntries();
  return all.filter(
    (e) => (e.source === "shelter" && ciIds.has(e.id)) || (e.source === "zozio" && mpIds.has(e.id)),
  );
}

export interface MagazineArticle {
  source: MagazineSource;
  id: string;
  slug: string;
  title: string;
  body: string | null;
  coverUrl: string | null;
  kind: MagazineKind;
  publishedAt: string | null;
  readingMinutes: number | null;
  sourceLabel: string;
  authorLabel: string;
  /** Útulek (jen u shelter článků) — pro moderaci a odkazy. */
  institutionId: string | null;
  institutionSlug: string | null;
}

/** Načte platform článek „od Zozio" pro /magazin/[slug]. */
export async function loadZozioArticle(slug: string): Promise<MagazineArticle | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("magazine_posts")
    .select("id, title, slug, category, body, cover_url, author, published_at, status")
    .eq("slug", slug)
    .eq("status", "published")
    .maybeSingle();
  if (!data) return null;
  const m = data as unknown as MagazinePostFeedRow & { status: string };
  return {
    source: "zozio",
    id: m.id,
    slug: m.slug,
    title: m.title,
    body: m.body,
    coverUrl: m.cover_url,
    kind: magazineKindFromCategory(m.category),
    publishedAt: m.published_at,
    readingMinutes: readingMinutes(m.body),
    sourceLabel: "od Zozio",
    authorLabel: m.author || "Redakce Zozio",
    institutionId: null,
    institutionSlug: null,
  };
}

export interface ArticleAnimalCard {
  id: string;
  name: string;
  species: Species;
  breed: string | null;
  ageLabel: string;
  photo: string | null;
  status: AdoptionStatus;
  matchScore: number | null;
}

type AnimalRowForArticle = MatchAnimal & {
  id: string;
  name: string;
  breed: string | null;
  age_years: number | null;
  age_months: number | null;
  birth_date: string | null;
  primary_photo_url: string | null;
  adoption_status: AdoptionStatus;
};

/** Zvířata navázaná na článek (M:N) s aktuálním stavem a volitelným % shody. */
export async function loadArticleAnimals(
  target: { source: MagazineSource; id: string },
  prefs: AdopterPreferences | null,
): Promise<ArticleAnimalCard[]> {
  const supabase = await createClient();
  const col = target.source === "shelter" ? "content_item_id" : "magazine_post_id";

  const { data: links } = await supabase
    .from("article_animals")
    .select("animal_id")
    .eq(col, target.id);

  const ids = [...new Set(((links ?? []) as { animal_id: string }[]).map((l) => l.animal_id))];
  if (ids.length === 0) return [];

  const { data: animals } = await supabase
    .from("animals")
    .select(
      `id, name, species, breed, age_years, age_months, birth_date, primary_photo_url, adoption_status,
       size, energy_level, good_with_children, good_with_dogs, good_with_cats, needs_garden,
       suitable_housing, adopter_experience, care_difficulty, health_status`,
    )
    .in("id", ids);

  return ((animals ?? []) as unknown as AnimalRowForArticle[]).map((a) => ({
    id: a.id,
    name: a.name,
    species: a.species,
    breed: a.breed,
    ageLabel: animalAgeLabel(a),
    photo: a.primary_photo_url,
    status: a.adoption_status,
    matchScore: prefs
      ? scoreAdopterMatch(prefs, {
          species: a.species,
          size: a.size,
          energy_level: a.energy_level,
          good_with_children: a.good_with_children,
          good_with_dogs: a.good_with_dogs,
          good_with_cats: a.good_with_cats,
          needs_garden: a.needs_garden,
          suitable_housing: a.suitable_housing,
          adopter_experience: a.adopter_experience,
          care_difficulty: a.care_difficulty,
          health_status: a.health_status,
        }).score
      : null,
  }));
}

/** Počet líbí + zda daný návštěvník (user/anon) lajkoval. */
export async function loadLikeState(
  target: { source: MagazineSource; id: string },
  userId: string | null,
  anonToken: string | null,
): Promise<{ count: number; liked: boolean }> {
  const supabase = await createClient();
  const col = target.source === "shelter" ? "content_item_id" : "magazine_post_id";

  const { count } = await supabase
    .from("article_likes")
    .select("id", { count: "exact", head: true })
    .eq(col, target.id);

  let liked = false;
  if (userId) {
    const { data } = await supabase
      .from("article_likes")
      .select("id")
      .eq(col, target.id)
      .eq("user_id", userId)
      .maybeSingle();
    liked = Boolean(data);
  } else if (anonToken) {
    const { data } = await supabase
      .from("article_likes")
      .select("id")
      .eq(col, target.id)
      .eq("anon_token", anonToken)
      .maybeSingle();
    liked = Boolean(data);
  }

  return { count: count ?? 0, liked };
}

export interface PublicComment {
  id: string;
  authorName: string;
  badge: "author" | "member" | null;
  body: string;
  createdAt: string;
  likeCount: number;
  liked: boolean;
  replies: PublicComment[];
}

/** Schválené komentáře článku jako vlákna + jména, odznaky a stav líbí návštěvníka. */
export async function loadComments(
  target: { source: MagazineSource; id: string; institutionId: string | null },
  userId: string | null,
  anonToken: string | null,
): Promise<{ comments: PublicComment[]; total: number }> {
  const supabase = await createClient();
  const col = target.source === "shelter" ? "content_item_id" : "magazine_post_id";

  const { data: rows } = await supabase
    .from("article_comments")
    .select("id, parent_id, user_id, guest_name, body, like_count, created_at")
    .eq(col, target.id)
    .eq("status", "approved")
    .order("created_at", { ascending: true });

  type Row = {
    id: string;
    parent_id: string | null;
    user_id: string | null;
    guest_name: string | null;
    body: string;
    like_count: number;
    created_at: string;
  };
  const list = (rows ?? []) as Row[];
  if (list.length === 0) return { comments: [], total: 0 };

  // Jména přihlášených.
  const userIds = [...new Set(list.map((r) => r.user_id).filter((x): x is string => Boolean(x)))];
  const names = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from("applicant_profiles")
      .select("user_id, full_name")
      .in("user_id", userIds);
    for (const p of (profiles ?? []) as { user_id: string; full_name: string | null }[]) {
      if (p.full_name) names.set(p.user_id, p.full_name);
    }
  }

  // Autorský odznak: členové útulku u shelter článku.
  const authorIds = new Set<string>();
  if (target.source === "shelter" && target.institutionId) {
    const { data: members } = await supabase
      .from("institution_members")
      .select("user_id")
      .eq("institution_id", target.institutionId);
    for (const m of (members ?? []) as { user_id: string }[]) authorIds.add(m.user_id);
  }

  // Líbí návštěvníka u komentářů.
  const myLiked = new Set<string>();
  const commentIds = list.map((r) => r.id);
  if (userId || anonToken) {
    const q = supabase.from("comment_likes").select("comment_id").in("comment_id", commentIds);
    const { data: cl } = userId ? await q.eq("user_id", userId) : await q.eq("anon_token", anonToken!);
    for (const r of (cl ?? []) as { comment_id: string }[]) myLiked.add(r.comment_id);
  }

  const toPublic = (r: Row): PublicComment => ({
    id: r.id,
    authorName: r.user_id ? names.get(r.user_id) ?? "Uživatel" : r.guest_name ?? "Host",
    badge: r.user_id && authorIds.has(r.user_id) ? "author" : r.user_id ? "member" : null,
    body: r.body,
    createdAt: r.created_at,
    likeCount: r.like_count,
    liked: myLiked.has(r.id),
    replies: [],
  });

  const byId = new Map<string, PublicComment>();
  const roots: PublicComment[] = [];
  for (const r of list) byId.set(r.id, toPublic(r));
  for (const r of list) {
    const node = byId.get(r.id)!;
    if (r.parent_id && byId.has(r.parent_id)) byId.get(r.parent_id)!.replies.push(node);
    else roots.push(node);
  }

  return { comments: roots, total: list.length };
}

/** Související články („Mohlo by tě zajímat") — pár nejnovějších mimo aktuální. */
export async function loadRelated(
  current: { source: MagazineSource; id: string },
  limit = 3,
): Promise<MagazineEntry[]> {
  const { entries, featured } = await loadMagazineFeed("all");
  const pool = featured ? [featured, ...entries] : entries;
  return pool
    .filter((e) => !(e.source === current.source && e.id === current.id))
    .slice(0, limit);
}

const ANIMAL_FALLBACK: Record<Species, string> = {
  dog: "🐶",
  cat: "🐱",
  rabbit: "🐰",
  other: "🐾",
};

export function animalEmoji(species: Species): string {
  return ANIMAL_FALLBACK[species] ?? "🐾";
}

// Re-export typů pro spotřebitele.
export type {
  AdopterPreferences,
  AdoptionStatus,
  AnimalSize,
  AdopterExperience,
  CareDifficulty,
  Compatibility,
  EnergyLevel,
  HealthStatus,
  SuitableHousing,
};
