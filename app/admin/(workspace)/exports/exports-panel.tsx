"use client";

import { useState } from "react";
import { Download } from "lucide-react";

const EXPORTS: { type: string; label: string; desc: string }[] = [
  {
    type: "intake",
    label: "Přijatá zvířata",
    desc: "Evidence příjmu — způsob, datum, nález, právní stav.",
  },
  {
    type: "output",
    label: "Vydaná zvířata",
    desc: "Adopce, úhyny a vrácení — datum a způsob výdeje.",
  },
  {
    type: "escapes",
    label: "Úniky",
    desc: "Útěky a úniky zvířat, místo, řešení a nahlášení.",
  },
  {
    type: "deaths",
    label: "Úhyny a utracení",
    desc: "Záznamy o úhynu/utracení s příčinou a veterinářem.",
  },
  {
    type: "health",
    label: "Zdravotní zásahy",
    desc: "Veterinární záznamy — úkony, kategorie, poznámky.",
  },
  {
    type: "costs",
    label: "Náklady",
    desc: "Náklady na zvířata podle kategorie a data.",
  },
  {
    type: "capacity",
    label: "Kapacita (aktuální stav)",
    desc: "Momentální obsazení — zvířata, stav a kotce.",
  },
];

const inputCls =
  "rounded-xl bg-cream-warm px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300";

export function ExportsPanel() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  function href(type: string): string {
    const p = new URLSearchParams({ type });
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return `/api/admin/exports?${p.toString()}`;
  }

  const dated = (type: string) => type !== "capacity";

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
        <h3 className="font-display text-lg font-bold text-ink-900">
          Období
        </h3>
        <p className="mt-1 text-sm text-ink-600">
          Volitelně omez exporty na rozsah dat. „Kapacita" vždy zobrazuje
          aktuální stav.
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
              Od
            </span>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className={inputCls}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
              Do
            </span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={inputCls}
            />
          </label>
          {(from || to) && (
            <button
              type="button"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
              className="rounded-pill px-3 py-2 text-sm font-semibold text-ink-600 hover:bg-cream-warm"
            >
              Vymazat
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {EXPORTS.map((e) => (
          <a
            key={e.type}
            href={href(e.type)}
            className="group flex items-start justify-between gap-3 rounded-3xl bg-cream p-5 ring-1 ring-ink-900/8 transition hover:-translate-y-0.5 hover:shadow-soft-md"
          >
            <div>
              <div className="font-display text-lg font-bold text-ink-900">
                {e.label}
              </div>
              <p className="mt-1 text-sm text-ink-600">{e.desc}</p>
              {dated(e.type) && (from || to) && (
                <p className="mt-1 text-xs font-semibold text-meadow-600">
                  {from || "…"} – {to || "…"}
                </p>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-meadow-500 p-2 text-cream group-hover:bg-meadow-600">
              <Download className="size-4" />
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
