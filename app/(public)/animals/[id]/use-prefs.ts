"use client";

import { useEffect, useState } from "react";

import type { AdopterPreferences } from "@/lib/matching";
import { saveAdopterPreferences } from "../../adopt/matching-actions";

const LS_PREFS = "zozio.match.prefs";
const LS_FREE = "zozio.match.freetext";
const LS_SUMMARY = "zozio.match.summary";
const LS_ACTIVE = "zozio.match.active";

/**
 * Sdílí preference AI matchingu mezi sidebarem „AI shoda" a podobnými zvířaty.
 * Účet má přednost (initial), jinak localStorage. Po kvízu uloží do obojího.
 */
export function useAdopterPrefs(initial: {
  answers: AdopterPreferences;
  freetext: string;
  aiSummary: string | null;
} | null) {
  const [prefs, setPrefs] = useState<AdopterPreferences | null>(initial?.answers ?? null);
  const [summary, setSummary] = useState<string | null>(initial?.aiSummary ?? null);
  const [freetext, setFreetext] = useState(initial?.freetext ?? "");

  useEffect(() => {
    if (initial) return;
    try {
      const raw = localStorage.getItem(LS_PREFS);
      if (raw && localStorage.getItem(LS_ACTIVE) !== "0") {
        setPrefs(JSON.parse(raw));
        setFreetext(localStorage.getItem(LS_FREE) ?? "");
        setSummary(localStorage.getItem(LS_SUMMARY));
      }
    } catch {
      /* ignore */
    }
  }, [initial]);

  function save(p: AdopterPreferences, ft: string, sum: string | null, isLoggedIn: boolean) {
    setPrefs(p);
    setFreetext(ft);
    setSummary(sum);
    try {
      localStorage.setItem(LS_PREFS, JSON.stringify(p));
      localStorage.setItem(LS_FREE, ft);
      if (sum) localStorage.setItem(LS_SUMMARY, sum);
      else localStorage.removeItem(LS_SUMMARY);
      localStorage.setItem(LS_ACTIVE, "1");
    } catch {
      /* ignore */
    }
    if (isLoggedIn) void saveAdopterPreferences({ answers: p, freetext: ft, aiSummary: sum });
  }

  return { prefs, summary, freetext, save };
}
