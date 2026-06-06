"use client";

import { useState } from "react";
import { ArrowLeft, Sparkles, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { QUIZ_QUESTIONS, type AdopterPreferences } from "@/lib/matching";

import { refineFromFreetext } from "./matching-actions";

/**
 * Kvíz AI matchingu — 8 otázek s velkými volbami + nepovinný volný text.
 * Po dokončení vrátí strukturované preference (+ AI shrnutí, je-li text).
 */
export function MatchQuiz({
  initial,
  onClose,
  onComplete,
}: {
  initial?: { answers: AdopterPreferences; freetext: string };
  onClose: () => void;
  onComplete: (answers: AdopterPreferences, freetext: string, aiSummary: string | null) => void;
}) {
  const total = QUIZ_QUESTIONS.length;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<AdopterPreferences>(initial?.answers ?? {});
  const [freetext, setFreetext] = useState(initial?.freetext ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const isFreetextStep = step === total;
  const q = isFreetextStep ? null : QUIZ_QUESTIONS[step];
  const progress = Math.round(((step + (isFreetextStep ? 1 : 0)) / (total + 1)) * 100);

  function choose(value: string) {
    if (!q) return;
    const patch = q.parse ? q.parse(value) : ({ [q.id]: value } as Partial<AdopterPreferences>);
    setAnswers((a) => ({ ...a, ...patch }));
    setStep((s) => s + 1);
  }

  function selectedValue(): string | undefined {
    if (!q) return undefined;
    const v = answers[q.id];
    if (typeof v === "boolean") return v ? "yes" : "no";
    return typeof v === "string" ? v : undefined;
  }

  async function finish() {
    setBusy(true);
    setErr(null);
    if (freetext.trim()) {
      const res = await refineFromFreetext(freetext, answers);
      setBusy(false);
      if ("error" in res) {
        // AI selhalo → dokonči aspoň na pravidlech, ukaž hlášku.
        setErr(res.error + " Pokračuji jen podle odpovědí.");
        return;
      }
      onComplete(res.prefs, freetext, res.summary);
      return;
    }
    setBusy(false);
    onComplete(answers, freetext, null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-900/70 p-0 backdrop-blur-sm sm:items-center sm:p-6">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-background shadow-soft-lg ring-1 ring-ink-900/10 sm:rounded-3xl">
        {/* Header + progress */}
        <div className="flex items-center gap-3 border-b border-ink-900/8 px-5 py-3.5">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="text-ink-500 hover:text-ink-700"
              aria-label="Zpět"
            >
              <ArrowLeft className="size-5" />
            </button>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-sm font-bold text-terracotta-600">
              <Sparkles className="size-4" /> AI matching
            </span>
          )}
          <div className="mx-2 h-1.5 flex-1 overflow-hidden rounded-full bg-cream-deeper">
            <div
              className="h-full rounded-full bg-terracotta-500 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-ink-500 hover:text-ink-700"
            aria-label="Zavřít"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Orientační charakter — ať je jasné, čím je výsledek omezený. */}
        <div className="flex items-start gap-2 border-b border-ink-900/8 bg-cream-warm px-5 py-2.5 text-[11.5px] font-semibold leading-snug text-ink-500">
          <span className="shrink-0">ⓘ</span>
          <span>
            Výsledek je jen orientační — počítáme ho z údajů, které o zvířatech máme
            (některé nemusí být vyplněné). O každé adopci rozhoduje vždy daný útulek.
          </span>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-7">
          {q ? (
            <>
              <h2 className="font-display text-2xl font-bold tracking-tight text-ink-900">
                {q.title}
              </h2>
              {q.hint && <p className="mt-1.5 text-sm text-ink-500">{q.hint}</p>}
              <div className="mt-6 grid gap-3">
                {q.options.map((o) => {
                  const on = selectedValue() === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => choose(o.value)}
                      className={cn(
                        "flex items-center gap-3.5 rounded-2xl border-[1.5px] px-4 py-3.5 text-left text-base font-bold transition",
                        on
                          ? "border-terracotta-500 bg-peach-100 text-terracotta-600"
                          : "border-ink-900/10 bg-card text-ink-700 hover:border-terracotta-400",
                      )}
                    >
                      {o.emoji && <span className="text-2xl">{o.emoji}</span>}
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <h2 className="font-display text-2xl font-bold tracking-tight text-ink-900">
                Chceš něco dodat? <span className="text-ink-400">(nepovinné)</span>
              </h2>
              <p className="mt-1.5 text-sm text-ink-500">
                Napiš vlastními slovy, koho hledáš — AI z toho vytáhne další preference a doladí
                pořadí.
              </p>
              <textarea
                value={freetext}
                onChange={(e) => setFreetext(e.target.value)}
                rows={4}
                placeholder="Např. Bydlím v bytě, jsem hodně aktivní, chci parťáka na běhání. Mám malé dítě…"
                className="mt-4 w-full rounded-2xl border border-ink-900/12 bg-card px-4 py-3 text-sm focus:border-terracotta-500 focus:outline-none"
              />
              {err && (
                <div className="mt-3 rounded-2xl bg-sunshine-200/60 px-4 py-2 text-sm font-semibold text-sunshine-600">
                  {err}
                </div>
              )}
            </>
          )}
        </div>

        {isFreetextStep && (
          <div className="flex gap-2 border-t border-ink-900/8 px-6 py-4">
            <button
              type="button"
              disabled={busy}
              onClick={() => onComplete(answers, freetext, null)}
              className="rounded-pill border border-ink-900/12 px-5 py-3 text-sm font-bold text-ink-600 hover:bg-cream-warm disabled:opacity-50"
            >
              Přeskočit
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={finish}
              className="ml-auto inline-flex items-center gap-1.5 rounded-pill bg-terracotta-500 px-6 py-3 text-sm font-bold text-cream shadow-soft-md hover:bg-terracotta-600 disabled:opacity-50"
            >
              <Sparkles className="size-4" />
              {busy ? "Vyhodnocuji…" : freetext.trim() ? "Doladit AI a zobrazit" : "Zobrazit shody"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
