import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { sanitizeHtml } from "@/lib/sanitize";
import { loadAdopterPreferences } from "../../adopt/matching-actions";
import {
  KIND_LABEL,
  loadArticleAnimals,
  loadComments,
  loadLikeState,
  loadRelated,
  loadZozioArticle,
  sourceTagClass,
  type MagazineEntry,
} from "@/lib/magazine";

import { ArticleReactions } from "../article-reactions";
import { ArticleComments } from "../article-comments";
import { ArticleAnimals } from "../article-animals";

export const revalidate = 60;

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const article = await loadZozioArticle(slug);
  if (!article) return { title: "Článek nenalezen — Zozio" };
  const description = article.body
    ? article.body.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160)
    : "Magazín Zozio";
  return {
    title: `${article.title} · Magazín Zozio`,
    description,
    openGraph: {
      title: article.title,
      description,
      type: "article",
      images: article.coverUrl ? [article.coverUrl] : [],
    },
  };
}

const KIND_EMOJI: Record<string, string> = { story: "🎉", event: "📅", news: "📰", guide: "📖" };

export default async function MagazineArticlePage({ params }: PageProps) {
  const { slug } = await params;
  const article = await loadZozioArticle(slug);
  if (!article) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const jar = await cookies();
  const anonToken = jar.get("zoz_anon")?.value ?? null;

  const prefs = await loadAdopterPreferences();
  const target = { source: article.source, id: article.id };

  const [animals, like, commentData, related] = await Promise.all([
    loadArticleAnimals(target, prefs?.answers ?? null),
    loadLikeState(target, user?.id ?? null, anonToken),
    loadComments({ ...target, institutionId: article.institutionId }, user?.id ?? null, anonToken),
    loadRelated(target, 3),
  ]);

  const viewerName =
    (user?.user_metadata?.full_name as string | undefined) ??
    (user?.email ? user.email.split("@")[0] : null);

  const safeBody = article.body ? sanitizeHtml(article.body) : "";
  const revalidatePath = `/magazin/${slug}`;

  const tagEntry = { source: article.source, kind: article.kind } as Pick<MagazineEntry, "source" | "kind">;

  return (
    <>
      <article className="mx-auto max-w-[760px] px-4 pb-8 pt-6 sm:px-6">
        <Link
          href="/magazin"
          className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-terracotta-600"
        >
          <ChevronLeft className="size-4" /> Zpět na Magazín
        </Link>

        <span className={`inline-block rounded-pill px-3 py-1 text-xs font-bold ${sourceTagClass(tagEntry)}`}>
          {article.source === "zozio" ? "od Zozio" : KIND_LABEL[article.kind]}
        </span>

        <h1 className="mt-3.5 font-display text-3xl font-bold leading-[1.1] tracking-tight text-ink-900 md:text-5xl">
          {article.title}
        </h1>

        <div className="mt-3.5 flex flex-wrap items-center gap-3 border-b border-ink-900/8 pb-5 text-[13px] font-bold text-ink-500">
          <span className="flex size-9 items-center justify-center rounded-full bg-ink-900 text-xs font-bold text-cream">
            {article.authorLabel.slice(0, 1).toUpperCase()}
          </span>
          <span>{article.authorLabel}</span>
          {article.publishedAt && (
            <>
              <span>·</span>
              <span>{new Date(article.publishedAt).toLocaleDateString("cs-CZ")}</span>
            </>
          )}
          {article.readingMinutes && (
            <>
              <span>·</span>
              <span>{article.readingMinutes} min čtení</span>
            </>
          )}
        </div>

        {/* Hero */}
        <div className="relative my-6 flex h-56 items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-sunshine-100 to-peach-100 text-6xl md:h-72">
          {article.coverUrl ? (
            <Image src={article.coverUrl} alt={article.title} fill sizes="760px" className="object-cover" priority />
          ) : (
            KIND_EMOJI[article.kind]
          )}
        </div>

        {/* Tělo */}
        {safeBody && (
          <div
            className="space-y-4 text-[17px] leading-relaxed text-ink-700 [&_a]:font-semibold [&_a]:text-meadow-700 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-terracotta-400 [&_blockquote]:pl-4 [&_blockquote]:font-display [&_blockquote]:text-xl [&_blockquote]:italic [&_blockquote]:text-terracotta-600 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-ink-900 [&_h3]:mt-6 [&_h3]:font-display [&_h3]:text-xl [&_h3]:font-bold [&_h3]:text-ink-900 [&_img]:rounded-2xl [&_li]:ml-5 [&_li]:list-disc [&_ol_li]:list-decimal [&_strong]:font-bold [&_ul]:space-y-1"
            dangerouslySetInnerHTML={{ __html: safeBody }}
          />
        )}

        <ArticleAnimals animals={animals} />

        <ArticleReactions
          source={article.source}
          id={article.id}
          initialLiked={like.liked}
          initialCount={like.count}
        />
      </article>

      <ArticleComments
        source={article.source}
        id={article.id}
        revalidate={revalidatePath}
        isLoggedIn={Boolean(user)}
        viewerName={viewerName}
        comments={commentData.comments}
        total={commentData.total}
      />

      {related.length > 0 && (
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <h2 className="mb-5 font-display text-2xl font-bold tracking-tight text-ink-900">
            Mohlo by tě zajímat
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {related.map((e) => (
              <Link
                key={`${e.source}-${e.id}`}
                href={e.href}
                className="group overflow-hidden rounded-3xl bg-card ring-1 ring-ink-900/8 transition hover:-translate-y-1 hover:shadow-soft-lg"
              >
                <div className="relative flex h-28 items-center justify-center bg-gradient-to-br from-peach-100 to-cream-warm text-4xl">
                  {e.coverUrl ? (
                    <Image src={e.coverUrl} alt={e.title} fill sizes="(min-width:640px) 33vw, 100vw" className="object-cover" />
                  ) : (
                    KIND_EMOJI[e.kind]
                  )}
                </div>
                <div className="p-4">
                  <div className="font-display text-base font-bold leading-snug text-ink-900">{e.title}</div>
                  <div className="mt-1.5 text-xs font-semibold text-ink-400">
                    {e.source === "zozio" ? "od Zozio" : e.sourceLabel}
                    {e.readingMinutes ? ` · ${e.readingMinutes} min` : ""}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
