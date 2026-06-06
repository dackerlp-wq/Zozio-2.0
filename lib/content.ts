/**
 * Pomocné funkce modulu Web & obsah — client-safe (bez DB importů).
 */
import type { ContentStatus, ContentType, NewsletterSegment } from "@/types/database";

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "clanek";
}

export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  article: "Článek",
  story: "Příběh",
  event: "Akce",
};

/** Kategorie článku (chip). */
export const CATEGORY_LABEL: Record<string, string> = {
  news: "Novinka",
  story: "Příběh",
  event: "Akce",
};
export const CATEGORY_BADGE: Record<string, string> = {
  news: "bg-meadow-50 text-meadow-700",
  story: "bg-fern-50 text-fern-700",
  event: "bg-sunshine-200 text-sunshine-600",
};

export const STATUS_LABEL: Record<ContentStatus, string> = {
  draft: "Koncept",
  published: "Publikováno",
  scheduled: "Naplánováno",
};
export const STATUS_BADGE: Record<ContentStatus, string> = {
  draft: "bg-cream-warm text-ink-500",
  published: "bg-fern-50 text-fern-700",
  scheduled: "bg-sunshine-200 text-sunshine-600",
};

export const SEGMENT_LABEL: Record<NewsletterSegment | "all", string> = {
  all: "Vše",
  donor: "Dárci",
  adopter: "Adoptanti",
  supporter: "Příznivci",
};

// --- Widget ----------------------------------------------------------------

export interface WidgetConfig {
  scope: "adoptable" | "with_found";
  species: "all" | "dog" | "cat";
  layout: "grid" | "list";
  count: 3 | 6 | 9;
  theme: "light" | "dark";
}

export const DEFAULT_WIDGET: WidgetConfig = {
  scope: "adoptable",
  species: "all",
  layout: "grid",
  count: 6,
  theme: "light",
};

/** Vygeneruje `<script>` embed kód dle konfigurace. */
export function buildEmbedCode(slug: string, cfg: WidgetConfig, baseUrl: string): string {
  return `<script src="${baseUrl}/embed.js"
  data-utulek="${slug}"
  data-druh="${cfg.species}"
  data-pocet="${cfg.count}"
  data-rozsah="${cfg.scope}"
  data-layout="${cfg.layout}"
  data-motiv="${cfg.theme}"></script>`;
}
