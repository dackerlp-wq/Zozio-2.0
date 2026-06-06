"use client";

import { scoreAdopterMatch, type AdopterPreferences, type MatchAnimal } from "@/lib/matching";
import { useAdopterPrefs } from "../use-prefs";

/** Malý štítek % shody do sidebaru formuláře (jen když má návštěvník kvíz). */
export function MatchBadge({
  animal,
  initialPrefs,
}: {
  animal: MatchAnimal;
  initialPrefs: { answers: AdopterPreferences; freetext: string; aiSummary: string | null } | null;
}) {
  const { prefs } = useAdopterPrefs(initialPrefs);
  if (!prefs) return null;
  const m = scoreAdopterMatch(prefs, animal);
  const cls =
    m.tone === "high" ? "bg-fern-600 text-cream" : m.tone === "mid" ? "bg-sunshine-400 text-ink-900" : "bg-cream-deeper text-ink-700";
  return (
    <span className={`absolute bottom-3 left-3 rounded-pill px-3 py-1.5 font-display text-sm font-bold shadow-soft-sm ${cls}`}>
      {m.score} % shoda
    </span>
  );
}
