"use client";

import { useState } from "react";
import { Download } from "lucide-react";

/**
 * Stažení kompletní historie změn zvířete za zvolené období do CSV.
 * Bez zadaného data se stáhne celá historie.
 */
export function HistoryExport({ animalId }: { animalId: string }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const params = new URLSearchParams({ type: "animal_history", id: animalId });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const href = `/api/admin/exports?${params.toString()}`;

  const inputCls =
    "rounded-xl bg-cream-warm px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300";

  return (
    <div className="rounded-2xl bg-cream-warm/60 p-4 ring-1 ring-ink-900/8">
      <p className="mb-3 text-sm font-semibold text-ink-900">
        Stáhnout kompletní historii (CSV)
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-ink-500">
          Od
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-500">
          Do
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className={inputCls}
          />
        </label>
        <a
          href={href}
          className="inline-flex items-center gap-2 rounded-pill bg-ink-900 px-4 py-2 text-sm font-semibold text-cream transition hover:bg-ink-700"
        >
          <Download className="size-4" />
          Stáhnout CSV
        </a>
      </div>
      <p className="mt-2 text-xs text-ink-400">
        Bez zadaného období se stáhne celá historie změn.
      </p>
    </div>
  );
}
