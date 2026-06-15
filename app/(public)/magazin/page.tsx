import Image from "next/image";
import Link from "next/link";

import { NewsletterForm } from "../newsletter-form";
import {
  KIND_LABEL,
  MAGAZINE_TABS,
  loadMagazineFeed,
  sourceTagClass,
  type MagazineEntry,
} from "@/lib/magazine";

export const revalidate = 120;

export const metadata = {
  title: "Magazín — Příběhy, rady a novinky · Zozio",
  description:
    "Příběhy z útulků, praktické rady k adopci a novinky od redakce Zozio i útulků z celé sítě.",
  openGraph: {
    title: "Magazín Zozio",
    description: "Příběhy, rady a novinky od útulků i redakce Zozio.",
    type: "website",
  },
};

interface PageProps {
  searchParams: Promise<{ k?: string }>;
}

function metaLine(e: MagazineEntry): string {
  const parts: string[] = [];
  if (e.source === "zozio") parts.push(e.authorLabel);
  else parts.push(e.sourceLabel);
  if (e.publishedAt) parts.push(new Date(e.publishedAt).toLocaleDateString("cs-CZ"));
  if (e.readingMinutes) parts.push(`${e.readingMinutes} min čtení`);
  return parts.join(" · ");
}

function SourceTag({ entry }: { entry: MagazineEntry }) {
  const label =
    entry.source === "zozio"
      ? "od Zozio"
      : entry.kind === "story" || entry.kind === "event"
        ? KIND_LABEL[entry.kind]
        : entry.sourceLabel;
  return (
    <span className={`inline-block rounded-pill px-2.5 py-0.5 text-[11px] font-bold ${sourceTagClass(entry)}`}>
      {label}
    </span>
  );
}

const KIND_EMOJI: Record<string, string> = {
  story: "🎉",
  event: "📅",
  news: "📰",
  guide: "📖",
};

export default async function MagazinePage({ searchParams }: PageProps) {
  const { k } = await searchParams;
  const active = k && MAGAZINE_TABS.some((t) => t.key === k) ? k : "all";
  const { featured, entries } = await loadMagazineFeed(active);

  return (
    <>
      {/* Hlavička */}
      <section className="bg-gradient-to-br from-cream via-cream-warm to-peach-100/40">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-14">
          <div className="font-mono text-xs font-bold uppercase tracking-wider text-terracotta-600">
            Magazín
          </div>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-ink-900 md:text-5xl">
            Příběhy, rady a novinky
          </h1>
          <p className="mt-2 text-lg font-semibold text-ink-600">
            Od útulků z celé sítě i od redakce Zozio.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Kategorie-taby */}
        <div className="mb-6 flex flex-wrap gap-2">
          {MAGAZINE_TABS.map((t) => {
            const isActive = t.key === active;
            return (
              <Link
                key={t.key}
                href={t.key === "all" ? "/magazin" : `/magazin?k=${t.key}`}
                className={
                  isActive
                    ? "rounded-pill bg-ink-900 px-4 py-2 text-sm font-bold text-cream"
                    : "rounded-pill bg-card px-4 py-2 text-sm font-bold text-ink-700 ring-1 ring-ink-900/10 transition hover:ring-ink-900/25"
                }
              >
                {t.label}
              </Link>
            );
          })}
        </div>

        {/* Featured */}
        {featured && (
          <Link
            href={featured.href}
            className="group mb-7 grid overflow-hidden rounded-3xl bg-card ring-1 ring-ink-900/8 transition hover:shadow-soft-lg md:grid-cols-[1.3fr_1fr]"
          >
            <div className="relative flex min-h-[240px] items-center justify-center bg-gradient-to-br from-sunshine-100 to-peach-100 text-6xl">
              {featured.coverUrl ? (
                <Image src={featured.coverUrl} alt={featured.title} fill sizes="(min-width:768px) 55vw, 100vw" className="object-cover" />
              ) : (
                KIND_EMOJI[featured.kind]
              )}
            </div>
            <div className="p-7">
              <SourceTag entry={featured} />
              <h2 className="mt-3 font-display text-2xl font-bold leading-snug tracking-tight text-ink-900 md:text-3xl">
                {featured.title}
              </h2>
              {featured.excerpt && (
                <p className="mt-2.5 line-clamp-3 text-ink-600">{featured.excerpt}</p>
              )}
              <div className="mt-4 text-[13px] font-bold text-ink-400">{metaLine(featured)}</div>
            </div>
          </Link>
        )}

        {/* Mřížka */}
        {entries.length === 0 && !featured ? (
          <div className="rounded-3xl bg-cream-warm p-12 text-center text-ink-600">
            <div className="text-4xl">📭</div>
            <p className="mt-3 font-semibold">V této kategorii zatím nic není.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {entries.map((e) => (
              <Link
                key={`${e.source}-${e.id}`}
                href={e.href}
                className="group flex flex-col overflow-hidden rounded-3xl bg-card ring-1 ring-ink-900/8 transition hover:-translate-y-1 hover:shadow-soft-lg"
              >
                <div className="relative flex h-[150px] items-center justify-center bg-gradient-to-br from-peach-100 to-cream-warm text-5xl">
                  {e.coverUrl ? (
                    <Image src={e.coverUrl} alt={e.title} fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover" />
                  ) : (
                    KIND_EMOJI[e.kind]
                  )}
                </div>
                <div className="flex flex-1 flex-col p-4.5 px-4 py-4">
                  <SourceTag entry={e} />
                  <h3 className="mt-2.5 font-display text-lg font-bold leading-snug text-ink-900">
                    {e.title}
                  </h3>
                  <div className="mt-auto pt-3 text-[12.5px] font-semibold text-ink-400">{metaLine(e)}</div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Newsletter */}
        <div className="mt-9 rounded-3xl bg-ink-900 p-8 text-center text-cream md:p-10">
          <h3 className="font-display text-2xl font-bold">Nový díl rovnou do schránky</h3>
          <p className="mx-auto mt-2 max-w-md text-sm font-semibold text-cream/75">
            Příběhy z útulků, rady a novinky. Občas, bez spamu.
          </p>
          <NewsletterForm className="mt-5" />
        </div>
      </div>
    </>
  );
}
