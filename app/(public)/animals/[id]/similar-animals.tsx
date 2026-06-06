"use client";

import Link from "next/link";
import Image from "next/image";

import { cn } from "@/lib/utils";
import { SPECIES_LABEL } from "@/lib/format";
import { scoreAdopterMatch, type AdopterPreferences } from "@/lib/matching";
import type { SimilarAnimal } from "./query";

import { useAdopterPrefs } from "./use-prefs";

export function SimilarAnimals({
  items,
  initialPrefs,
}: {
  items: SimilarAnimal[];
  initialPrefs: { answers: AdopterPreferences; freetext: string; aiSummary: string | null } | null;
}) {
  const { prefs } = useAdopterPrefs(initialPrefs);

  const scored = items.map((a) => ({
    a,
    score: prefs ? scoreAdopterMatch(prefs, a.match).score : null,
    tone: prefs ? scoreAdopterMatch(prefs, a.match).tone : null,
  }));
  if (prefs) scored.sort((x, y) => (y.score ?? 0) - (x.score ?? 0));
  const top = scored.slice(0, 4);
  if (top.length === 0) return null;

  return (
    <section className="mt-16">
      <h2 className="mb-6 font-display text-3xl font-bold tracking-tight text-ink-900">
        <span className="text-sunshine-400">✨</span> Tobě by mohli sednout i
      </h2>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {top.map(({ a, score, tone }) => (
          <Link
            key={a.id}
            href={`/animals/${a.id}`}
            className="group overflow-hidden rounded-3xl bg-card shadow-soft-sm ring-1 ring-ink-900/5 transition hover:-translate-y-1 hover:shadow-soft-md"
          >
            <div className="relative flex h-32 items-center justify-center overflow-hidden bg-cream-warm text-4xl">
              {a.photo ? (
                <Image
                  src={a.photo}
                  alt={a.name}
                  fill
                  sizes="(min-width: 1024px) 25vw, 50vw"
                  className="object-cover transition group-hover:scale-[1.04]"
                />
              ) : a.species === "cat" ? (
                "🐈"
              ) : a.species === "rabbit" ? (
                "🐰"
              ) : (
                "🐕"
              )}
              {score != null && (
                <span
                  className={cn(
                    "absolute bottom-2 left-2 rounded-pill px-2.5 py-1 font-display text-xs font-bold shadow-soft-sm",
                    tone === "high"
                      ? "bg-fern-600 text-cream"
                      : tone === "mid"
                        ? "bg-sunshine-400 text-ink-900"
                        : "bg-cream-deeper text-ink-700",
                  )}
                >
                  {score} %
                </span>
              )}
            </div>
            <div className="p-4">
              <div className="font-display text-lg font-bold text-ink-900">{a.name}</div>
              <div className="text-xs font-semibold text-ink-400">
                {[a.breed ?? SPECIES_LABEL[a.species], a.city].filter(Boolean).join(" · ")}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
