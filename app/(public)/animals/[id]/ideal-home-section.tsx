"use client";

import { useEffect, useState } from "react";

import type { IdealHome } from "@/lib/ideal-home";
import { getOrGenerateIdealHome } from "./ideal-home-actions";

/**
 * „Ideální domov" — server vykreslí deterministickou základnu (SEO), klient
 * doplní hezčí AI formulace z cache (nebo je nechá vygenerovat na pozadí).
 */
export function IdealHomeSection({ animalId, base }: { animalId: string; base: IdealHome }) {
  const [data, setData] = useState<IdealHome>(base);

  useEffect(() => {
    let alive = true;
    getOrGenerateIdealHome(animalId)
      .then((res) => {
        if (alive && res.fits.length) setData({ fits: res.fits, notFits: res.notFits });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [animalId]);

  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-bold text-ink-900">Ideální domov</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-fern-50 p-5 ring-1 ring-fern-600/15">
          <div className="mb-2.5 text-sm font-bold text-fern-700">✓ Hodí se k</div>
          <ul className="space-y-1.5">
            {data.fits.map((t, i) => (
              <li key={i} className="text-sm font-semibold text-ink-700">
                {t}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl bg-peach-100 p-5 ring-1 ring-terracotta-400/15">
          <div className="mb-2.5 text-sm font-bold text-terracotta-600">✗ Nehodí se k</div>
          <ul className="space-y-1.5">
            {data.notFits.map((t, i) => (
              <li key={i} className="text-sm font-semibold text-ink-700">
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
