"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

import { scoreAdopterMatch, type AdopterPreferences, type MatchAnimal } from "@/lib/matching";
import { MatchQuiz } from "../../adopt/match-quiz";

import { useAdopterPrefs } from "./use-prefs";

export function AnimalMatch({
  name,
  animal,
  isLoggedIn,
  initialPrefs,
}: {
  name: string;
  animal: MatchAnimal;
  isLoggedIn: boolean;
  initialPrefs: { answers: AdopterPreferences; freetext: string; aiSummary: string | null } | null;
}) {
  const { prefs, freetext, save } = useAdopterPrefs(initialPrefs);
  const [quizOpen, setQuizOpen] = useState(false);

  // Bez kvízu → tmavá výzva.
  if (!prefs) {
    return (
      <>
        <div className="rounded-3xl bg-ink-900 p-6 text-cream">
          <div className="inline-flex items-center gap-2 font-display text-lg font-bold">
            <Sparkles className="size-5 text-sunshine-400" /> Jak moc ti {name} sedí?
          </div>
          <p className="mt-1.5 text-sm text-cream/70">
            Odpověz na pár otázek a spočítáme % shody s tebou — i u {name}.
          </p>
          <button
            type="button"
            onClick={() => setQuizOpen(true)}
            className="mt-4 w-full rounded-pill bg-terracotta-500 px-4 py-3 text-sm font-bold text-cream hover:bg-terracotta-600"
          >
            ✨ Spustit AI matching
          </button>
        </div>
        {quizOpen && (
          <MatchQuiz
            onClose={() => setQuizOpen(false)}
            onComplete={(p, ft, sum) => {
              save(p, ft, sum, isLoggedIn);
              setQuizOpen(false);
            }}
          />
        )}
      </>
    );
  }

  const m = scoreAdopterMatch(prefs, animal);
  const color =
    m.tone === "high" ? "#1A7A45" : m.tone === "mid" ? "#F0A500" : "#8B7355";
  const circumference = 2 * Math.PI * 42;
  const dash = (m.score / 100) * circumference;

  return (
    <>
      <div className="rounded-3xl bg-gradient-to-b from-card to-cream p-6 ring-1 ring-terracotta-400/20">
        <div className="flex items-center gap-4">
          <div className="relative size-24 shrink-0">
            <svg width="96" height="96" className="-rotate-90">
              <circle cx="48" cy="48" r="42" fill="none" stroke="#F0E8DC" strokeWidth="9" />
              <circle
                cx="48"
                cy="48"
                r="42"
                fill="none"
                stroke={color}
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${dash} ${circumference}`}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-bold leading-none" style={{ color }}>
                {m.score} %
              </span>
              <span className="text-[9px] font-bold uppercase tracking-wide text-ink-400">shoda</span>
            </div>
          </div>
          <div>
            <div className="inline-flex items-center gap-1.5 font-display text-base font-bold text-ink-900">
              <Sparkles className="size-4 text-terracotta-500" /> Sedí ti
            </div>
            <p className="mt-0.5 text-[13px] text-ink-500">
              Spočítáno z tvých odpovědí v AI matchingu.
            </p>
          </div>
        </div>

        {m.reasons.length > 0 && (
          <ul className="mt-4 space-y-2">
            {m.reasons.slice(0, 5).map((r, i) => (
              <li
                key={i}
                className={`flex items-start gap-2 text-[13px] font-semibold ${r.ok ? "text-ink-700" : "text-sunshine-600"}`}
              >
                <span className={`mt-px shrink-0 font-bold ${r.ok ? "text-fern-700" : "text-sunshine-600"}`}>
                  {r.ok ? "✓" : "!"}
                </span>
                <span>{r.text}</span>
              </li>
            ))}
          </ul>
        )}

        {m.missing.length > 0 && (
          <p className="mt-3 text-[11px] font-semibold text-ink-400">
            ⓘ −{m.missing.length * 10} % za neúplné údaje ({m.missing.join(", ")})
          </p>
        )}

        <p className="mt-3 border-t border-ink-900/8 pt-3 text-[11px] font-semibold leading-snug text-ink-400">
          ⓘ Jen orientační shoda podle dostupných údajů. O adopci rozhoduje vždy útulek.
        </p>

        <button
          type="button"
          onClick={() => setQuizOpen(true)}
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-bold text-terracotta-600 hover:text-terracotta-500"
        >
          <Sparkles className="size-3.5" /> Upravit odpovědi
        </button>
      </div>
      {quizOpen && (
        <MatchQuiz
          initial={{ answers: prefs, freetext }}
          onClose={() => setQuizOpen(false)}
          onComplete={(p, ft, sum) => {
            save(p, ft, sum, isLoggedIn);
            setQuizOpen(false);
          }}
        />
      )}
    </>
  );
}
