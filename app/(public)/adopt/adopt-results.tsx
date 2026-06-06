"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";

import { AnimalCard, type AnimalCardData } from "@/components/zozio/animal-card";
import { scoreAdopterMatch, type AdopterPreferences, type MatchAnimal } from "@/lib/matching";

import { MatchQuiz } from "./match-quiz";
import { saveAdopterPreferences } from "./matching-actions";

export interface ScoredCard extends AnimalCardData {
  match: MatchAnimal;
  createdAt: string;
  /** Datum příjmu do útulku — pro řazení „nejdéle čeká" při shodném %. */
  intakeDate: string;
}

type SortMode = "recommended" | "newest" | "longstay";

const LS_PREFS = "zozio.match.prefs";
const LS_FREE = "zozio.match.freetext";
const LS_SUMMARY = "zozio.match.summary";
const LS_ACTIVE = "zozio.match.active";

export function AdoptResults({
  cards,
  initial,
  isLoggedIn,
  page,
  totalPages,
  searchParams,
}: {
  cards: ScoredCard[];
  initial: { answers: AdopterPreferences; freetext: string; aiSummary: string | null } | null;
  isLoggedIn: boolean;
  page: number;
  totalPages: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const [prefs, setPrefs] = useState<AdopterPreferences | null>(initial?.answers ?? null);
  const [freetext, setFreetext] = useState(initial?.freetext ?? "");
  const [summary, setSummary] = useState<string | null>(initial?.aiSummary ?? null);
  const [active, setActive] = useState<boolean>(!!initial);
  const [sort, setSort] = useState<SortMode>(initial ? "recommended" : "newest");
  const [quizOpen, setQuizOpen] = useState(false);

  // Hydratace z localStorage pro nepřihlášené (účet má přednost).
  useEffect(() => {
    if (initial) return;
    try {
      const raw = localStorage.getItem(LS_PREFS);
      if (raw && localStorage.getItem(LS_ACTIVE) !== "0") {
        setPrefs(JSON.parse(raw));
        setFreetext(localStorage.getItem(LS_FREE) ?? "");
        setSummary(localStorage.getItem(LS_SUMMARY));
        setActive(true);
        setSort("recommended");
      }
    } catch {
      /* ignore */
    }
  }, [initial]);

  function persist(p: AdopterPreferences, ft: string, sum: string | null) {
    try {
      localStorage.setItem(LS_PREFS, JSON.stringify(p));
      localStorage.setItem(LS_FREE, ft);
      if (sum) localStorage.setItem(LS_SUMMARY, sum);
      else localStorage.removeItem(LS_SUMMARY);
      localStorage.setItem(LS_ACTIVE, "1");
    } catch {
      /* ignore */
    }
  }

  function onComplete(p: AdopterPreferences, ft: string, sum: string | null) {
    setPrefs(p);
    setFreetext(ft);
    setSummary(sum);
    setActive(true);
    setSort("recommended");
    setQuizOpen(false);
    persist(p, ft, sum);
    if (isLoggedIn) {
      void saveAdopterPreferences({ answers: p, freetext: ft, aiSummary: sum });
    }
  }

  function turnOff() {
    setActive(false);
    setSort("newest");
    try {
      localStorage.setItem(LS_ACTIVE, "0");
    } catch {
      /* ignore */
    }
  }

  const matchingOn = active && !!prefs;

  const display = useMemo(() => {
    const list = matchingOn
      ? cards.map((c) => {
          const m = scoreAdopterMatch(prefs!, c.match);
          return {
            ...c,
            matchScore: m.score,
            matchTone: m.tone,
            matchReason: m.headline ? { ok: m.headline.ok, text: m.headline.text } : null,
            matchReasons: m.reasons.map((r) => ({ ok: r.ok, text: r.text })),
            matchEnoughInfo: m.enoughInfo,
            matchMissing: m.missing,
          };
        })
      : cards.map((c) => ({ ...c }));

    const sorted = [...list];
    if (matchingOn && sort === "recommended") {
      // Jako člověk: nejdřív spolehlivé shody (dost informací), pak podle %,
      // a při shodném % má přednost ten, kdo je v útulku nejdéle (dřívější příjem).
      sorted.sort(
        (a, b) =>
          Number(b.matchEnoughInfo ?? true) - Number(a.matchEnoughInfo ?? true) ||
          (b.matchScore ?? 0) - (a.matchScore ?? 0) ||
          a.intakeDate.localeCompare(b.intakeDate),
      );
    } else if (sort === "longstay") {
      sorted.sort((a, b) => Number(b.isLongStay) - Number(a.isLongStay) || b.createdAt.localeCompare(a.createdAt));
    } else {
      sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    return sorted;
  }, [cards, matchingOn, prefs, sort]);

  return (
    <div className="min-w-0">
      {/* AI strip */}
      {matchingOn ? (
        <div className="mb-5 flex flex-wrap items-center gap-3.5 rounded-3xl bg-ink-900 px-5 py-4 text-cream">
          <Sparkles className="size-5 shrink-0 text-sunshine-400" />
          <div className="min-w-[180px] flex-1">
            <div className="font-display text-base font-bold">AI matching je zapnutý</div>
            <div className="text-[13px] text-cream/70">
              {summary ?? "Zvířata jsou seřazená podle shody s tvými odpověďmi."}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setQuizOpen(true)}
              className="rounded-pill bg-terracotta-500 px-4 py-2 text-[13px] font-bold text-cream hover:bg-terracotta-600"
            >
              Upravit odpovědi
            </button>
            <button
              type="button"
              onClick={turnOff}
              className="inline-flex items-center gap-1 rounded-pill border border-cream/40 px-4 py-2 text-[13px] font-bold text-cream hover:bg-cream/10"
            >
              <X className="size-3.5" /> Vypnout
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setQuizOpen(true)}
          className="mb-5 flex w-full flex-wrap items-center gap-3.5 rounded-3xl bg-gradient-to-r from-peach-100 to-sunshine-200/70 px-5 py-4 text-left ring-1 ring-terracotta-400/20 transition hover:shadow-soft-md"
        >
          <Sparkles className="size-5 shrink-0 text-terracotta-600" />
          <div className="min-w-[180px] flex-1">
            <div className="font-display text-base font-bold text-ink-900">
              Najdi to pravé pomocí AI
            </div>
            <div className="text-[13px] font-medium text-ink-600">
              Odpověz na pár otázek a zvířata se seřadí podle shody s tebou.
            </div>
          </div>
          <span className="rounded-pill bg-terracotta-500 px-4 py-2 text-[13px] font-bold text-cream">
            Spustit kvíz ✨
          </span>
        </button>
      )}

      {/* Ovládání + řazení */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-bold text-ink-500">{cards.length} výsledků na stránce</span>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="ml-auto rounded-pill border-[1.5px] border-ink-900/12 bg-card px-4 py-2 text-[13px] font-bold text-ink-700"
        >
          {matchingOn && <option value="recommended">✨ Doporučené pro tebe</option>}
          <option value="newest">Nejnovější</option>
          <option value="longstay">Dlouho čekají</option>
        </select>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {display.map((c) => (
          <AnimalCard key={c.id} animal={c} />
        ))}
      </div>

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} searchParams={searchParams} />
      )}

      {quizOpen && (
        <MatchQuiz
          initial={prefs ? { answers: prefs, freetext } : undefined}
          onClose={() => setQuizOpen(false)}
          onComplete={onComplete}
        />
      )}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  searchParams,
}: {
  page: number;
  totalPages: number;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const makeHref = (p: number) => {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => {
      if (k === "page") return;
      if (Array.isArray(v)) v.forEach((x) => params.append(k, x));
      else if (v) params.set(k, v);
    });
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/adopt?${qs}` : "/adopt";
  };

  return (
    <div className="mt-10 flex items-center justify-center gap-2">
      <Link
        href={makeHref(page - 1)}
        className={`rounded-pill border-[1.5px] border-ink-900/12 px-4 py-2 text-sm font-bold text-ink-700 ${page <= 1 ? "pointer-events-none opacity-40" : "hover:bg-cream-warm"}`}
      >
        ← Předchozí
      </Link>
      <span className="px-4 text-sm font-semibold text-ink-700">
        Strana {page} z {totalPages}
      </span>
      <Link
        href={makeHref(page + 1)}
        className={`rounded-pill border-[1.5px] border-ink-900/12 px-4 py-2 text-sm font-bold text-ink-700 ${page >= totalPages ? "pointer-events-none opacity-40" : "hover:bg-cream-warm"}`}
      >
        Další →
      </Link>
    </div>
  );
}
