"use server";

import { revalidatePath } from "next/cache";

import { ensurePermission } from "@/lib/auth";
import { slugify, type WidgetConfig } from "@/lib/content";
import { sanitizeHtml } from "@/lib/sanitize";
import { createServiceClient } from "@/lib/supabase/service";
import type { ContentStatus, ContentType } from "@/types/database";

type Result = { error: string } | { ok: true };

export interface ContentInput {
  type: ContentType;
  title: string;
  category: string;
  excerpt: string;
  body: string;
  cover_url: string;
  status: ContentStatus;
  scheduled_at: string;
  animal_id: string | null;
  /** Zmíněná zvířata (M:N) — sekce „Zvířata v článku" na webu. */
  animal_ids: string[];
  event_date: string;
  event_location: string;
}

/** Synchronizuje vazbu článek↔zvířata (M:N) podle zadaného seznamu. */
async function syncArticleAnimals(
  service: ReturnType<typeof createServiceClient>,
  contentItemId: string,
  animalIds: string[],
): Promise<void> {
  const unique = [...new Set(animalIds.filter(Boolean))];
  await service.from("article_animals").delete().eq("content_item_id", contentItemId);
  if (unique.length > 0) {
    await service.from("article_animals").insert(
      unique.map((animal_id) => ({ content_item_id: contentItemId, magazine_post_id: null, animal_id })),
    );
  }
}

async function uniqueSlug(
  service: ReturnType<typeof createServiceClient>,
  institutionId: string,
  base: string,
  excludeId?: string,
): Promise<string> {
  let slug = slugify(base);
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? slug : `${slug}-${i + 1}`;
    let q = service
      .from("content_items")
      .select("id")
      .eq("institution_id", institutionId)
      .eq("slug", candidate);
    if (excludeId) q = q.neq("id", excludeId);
    const { data } = await q.maybeSingle();
    if (!data) return candidate;
  }
  return `${slug}-${Date.now()}`;
}

function revalidate(slug?: string | null) {
  revalidatePath("/admin/content");
}

export async function createContent(
  input: ContentInput,
): Promise<{ ok: true; id: string } | { error: string }> {
  const perm = await ensurePermission("web");
  if (!perm.ok) return { error: perm.error };
  const { institutionId, user, institution } = perm.membership;
  if (!input.title.trim()) return { error: "Zadej název." };
  const service = createServiceClient();

  const slug = await uniqueSlug(service, institutionId, input.title);
  const publishing = input.status === "published";

  const { data, error } = await service
    .from("content_items")
    .insert({
      institution_id: institutionId,
      type: input.type,
      title: input.title.trim(),
      slug,
      category: input.category || (input.type === "story" ? "story" : input.type === "event" ? "event" : "news"),
      excerpt: input.excerpt.trim() || null,
      body: input.body ? sanitizeHtml(input.body) : null,
      cover_url: input.cover_url.trim() || null,
      status: input.status,
      published_at: publishing ? new Date().toISOString() : null,
      scheduled_at: input.status === "scheduled" && input.scheduled_at ? input.scheduled_at : null,
      animal_id: input.animal_id,
      event_date: input.event_date || null,
      event_location: input.event_location.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Nepodařilo se uložit." };

  // Zmíněná zvířata: u příběhu vždy obsahuje i navázané zvíře.
  const ids = [...(input.animal_ids ?? []), ...(input.animal_id ? [input.animal_id] : [])];
  await syncArticleAnimals(service, data.id, ids);

  revalidate();
  if (institution.slug) revalidatePath(`/utulek/${institution.slug}`);
  return { ok: true, id: data.id };
}

export async function updateContent(id: string, input: ContentInput): Promise<Result> {
  const perm = await ensurePermission("web");
  if (!perm.ok) return { error: perm.error };
  const { institutionId, institution } = perm.membership;
  const service = createServiceClient();

  const slug = await uniqueSlug(service, institutionId, input.title, id);
  const { data: cur } = await service
    .from("content_items")
    .select("published_at")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  const prevPublishedAt = (cur as { published_at: string | null } | null)?.published_at ?? null;

  const { error } = await service
    .from("content_items")
    .update({
      title: input.title.trim(),
      slug,
      category: input.category || null,
      excerpt: input.excerpt.trim() || null,
      body: input.body ? sanitizeHtml(input.body) : null,
      cover_url: input.cover_url.trim() || null,
      status: input.status,
      published_at: input.status === "published" ? (prevPublishedAt ?? new Date().toISOString()) : null,
      scheduled_at: input.status === "scheduled" && input.scheduled_at ? input.scheduled_at : null,
      animal_id: input.animal_id,
      event_date: input.event_date || null,
      event_location: input.event_location.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("institution_id", institutionId);
  if (error) return { error: error.message };

  const ids = [...(input.animal_ids ?? []), ...(input.animal_id ? [input.animal_id] : [])];
  await syncArticleAnimals(service, id, ids);

  revalidate();
  if (institution.slug) revalidatePath(`/utulek/${institution.slug}`);
  return { ok: true };
}

/** Vyhledá zvířata útulku pro picker „Zmíněná zvířata". */
export async function searchArticleAnimals(
  query: string,
): Promise<{ id: string; name: string; species: string; breed: string | null }[]> {
  const perm = await ensurePermission("web");
  if (!perm.ok) return [];
  const service = createServiceClient();
  let q = service
    .from("animals")
    .select("id, name, species, breed")
    .eq("institution_id", perm.membership.institutionId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (query.trim()) q = q.ilike("name", `%${query.trim()}%`);
  const { data } = await q;
  return (data ?? []) as { id: string; name: string; species: string; breed: string | null }[];
}

/** Načte navázaná zvířata článku pro předvyplnění editoru. */
export async function loadContentAnimals(
  contentItemId: string,
): Promise<{ id: string; name: string; species: string; breed: string | null }[]> {
  const perm = await ensurePermission("web");
  if (!perm.ok) return [];
  const service = createServiceClient();
  const { data: links } = await service
    .from("article_animals")
    .select("animal_id")
    .eq("content_item_id", contentItemId);
  const ids = ((links ?? []) as { animal_id: string }[]).map((l) => l.animal_id);
  if (ids.length === 0) return [];
  const { data } = await service
    .from("animals")
    .select("id, name, species, breed")
    .in("id", ids)
    .eq("institution_id", perm.membership.institutionId);
  return (data ?? []) as { id: string; name: string; species: string; breed: string | null }[];
}

export async function setContentStatus(id: string, status: ContentStatus): Promise<Result> {
  const perm = await ensurePermission("web");
  if (!perm.ok) return { error: perm.error };
  const { institutionId, institution } = perm.membership;
  const service = createServiceClient();

  const { error } = await service
    .from("content_items")
    .update({
      status,
      published_at: status === "published" ? new Date().toISOString() : null,
    })
    .eq("id", id)
    .eq("institution_id", institutionId);
  if (error) return { error: error.message };

  revalidate();
  if (institution.slug) revalidatePath(`/utulek/${institution.slug}`);
  return { ok: true };
}

export async function deleteContent(id: string): Promise<Result> {
  const perm = await ensurePermission("web");
  if (!perm.ok) return { error: perm.error };
  const { institutionId } = perm.membership;
  const service = createServiceClient();

  const { error } = await service
    .from("content_items")
    .delete()
    .eq("id", id)
    .eq("institution_id", institutionId);
  if (error) return { error: error.message };
  revalidate();
  return { ok: true };
}

/** Uloží konfiguraci embed widgetu instituce. */
export async function saveWidgetConfig(config: WidgetConfig): Promise<Result> {
  const perm = await ensurePermission("web");
  if (!perm.ok) return { error: perm.error };
  const { institutionId } = perm.membership;
  const service = createServiceClient();
  const { error } = await service
    .from("institutions")
    .update({ widget_config: config })
    .eq("id", institutionId);
  if (error) return { error: error.message };
  revalidate();
  return { ok: true };
}

/** Založí koncept příběhu předvyplněný z adoptovaného zvířete. */
export async function createStoryFromAnimal(
  animalId: string,
): Promise<{ ok: true; id: string } | { error: string }> {
  const perm = await ensurePermission("web");
  if (!perm.ok) return { error: perm.error };
  const { institutionId, user } = perm.membership;
  const service = createServiceClient();

  const { data: animal } = await service
    .from("animals")
    .select("id, name, primary_photo_url, adoption_status")
    .eq("id", animalId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!animal) return { error: "Zvíře nenalezeno." };
  const a = animal as { name: string; primary_photo_url: string | null };

  // AI předvyplní nadpis, perex i text příběhu z údajů o zvířeti. Když AI selže
  // (chybí brána apod.), spadneme na jednoduché výchozí hodnoty — koncept vznikne tak jako tak.
  let title = `${a.name} našel/našla domov`;
  let excerpt = `Příběh ${a.name} — z útulku do nového domova.`;
  let body: string | null = null;
  try {
    const { generateAnimalCopyForAnimal } = await import("../animals/ai-actions");
    const ai = await generateAnimalCopyForAnimal(animalId);
    if ("ok" in ai && ai.ok) {
      title = ai.data.story_title?.trim() || title;
      excerpt = ai.data.description?.trim() || excerpt;
      const paragraphs = ai.data.story_text
        .split(/\n{2,}|\n/)
        .map((p) => p.trim())
        .filter(Boolean)
        .map((p) => `<p>${p}</p>`)
        .join("");
      body = paragraphs ? sanitizeHtml(paragraphs) : null;
    }
  } catch {
    // ticho — necháme výchozí hodnoty
  }

  const slug = await uniqueSlug(service, institutionId, title);
  const { data, error } = await service
    .from("content_items")
    .insert({
      institution_id: institutionId,
      type: "story",
      title,
      slug,
      category: "story",
      excerpt,
      body,
      cover_url: a.primary_photo_url,
      status: "draft",
      animal_id: animalId,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "Nepodařilo se založit příběh." };

  await syncArticleAnimals(service, data.id, [animalId]);

  revalidate();
  return { ok: true, id: data.id };
}
