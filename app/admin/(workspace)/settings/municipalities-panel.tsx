"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  addMunicipalities,
  listMyMunicipalities,
  removeMunicipality,
  type Muni,
} from "./municipalities-actions";
import { AdminMapPickerLoader } from "./admin-map-picker-loader";

interface CatalogObec {
  kod: number;
  nazev: string;
  okres: number | null;
}

export function MunicipalitiesPanel() {
  const [mine, setMine] = useState<Muni[]>([]);
  const [catalog, setCatalog] = useState<CatalogObec[]>([]);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "map">("list");
  const [krajMap, setKrajMap] = useState<Record<number, string>>({});
  const [pending, start] = useTransition();

  const krajFor = (okres: number | null) =>
    okres != null ? (krajMap[okres] ?? "").replace(/\s*kraj$/i, "") : "";

  useEffect(() => {
    listMyMunicipalities().then(setMine);
    fetch("/geo/okresy-kraje.json")
      .then((r) => r.json())
      .then(setKrajMap)
      .catch(() => setKrajMap({}));
    fetch("/geo/obce-cz.min.geojson")
      .then((r) => r.json())
      .then((gj: GeoJSON.FeatureCollection) => {
        setCatalog(
          gj.features.map((f) => ({
            kod: (f.properties as { kod: number }).kod,
            nazev: (f.properties as { nazev: string }).nazev,
            okres: (f.properties as { okres?: number }).okres ?? null,
          })),
        );
      })
      .catch(() => setCatalog([]));
  }, []);

  const mineKods = useMemo(() => new Set(mine.map((m) => m.kod)), [mine]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return catalog
      .filter((o) => !mineKods.has(o.kod) && o.nazev.toLowerCase().includes(q))
      .slice(0, 12);
  }, [query, catalog, mineKods]);

  function add(obce: CatalogObec[]) {
    if (obce.length === 0) return;
    setMsg(null);
    start(async () => {
      const res = await addMunicipalities(obce.map((o) => ({ kod: o.kod, nazev: o.nazev, okres: o.okres })));
      if ("error" in res) {
        setMsg(res.error);
        return;
      }
      if (res.conflicts.length > 0) {
        setMsg(
          `Přidáno ${res.added}. Tyto obce už pokrývá jiný útulek: ${res.conflicts
            .map((c) => c.nazev)
            .join(", ")}.`,
        );
      } else {
        setMsg(`Přidáno ${res.added} obcí.`);
      }
      setMine(await listMyMunicipalities());
      setQuery("");
    });
  }

  function remove(kod: number) {
    start(async () => {
      await removeMunicipality(kod);
      setMine(await listMyMunicipalities());
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-lg font-bold text-ink-900">Spádová oblast</h3>
        <p className="mt-1 text-sm text-ink-500">
          Obce, které váš útulek pokrývá. Zobrazí se na veřejné{" "}
          <a href="/mapa" className="font-semibold text-terracotta-600">mapě</a> a pomohou lidem najít vás
          při nálezu zvířete. Každá obec může patřit jen jednomu útulku.
        </p>
      </div>

      <div className="inline-flex rounded-pill bg-cream-warm p-1 ring-1 ring-ink-900/8">
        <button
          type="button"
          onClick={() => setView("list")}
          className={
            view === "list"
              ? "rounded-pill bg-card px-4 py-1.5 text-sm font-bold text-ink-900 shadow-soft-sm"
              : "rounded-pill px-4 py-1.5 text-sm font-bold text-ink-500"
          }
        >
          Seznam
        </button>
        <button
          type="button"
          onClick={() => setView("map")}
          className={
            view === "map"
              ? "rounded-pill bg-card px-4 py-1.5 text-sm font-bold text-ink-900 shadow-soft-sm"
              : "rounded-pill px-4 py-1.5 text-sm font-bold text-ink-500"
          }
        >
          Klikání do mapy
        </button>
      </div>

      {view === "map" && (
        <AdminMapPickerLoader onChanged={() => listMyMunicipalities().then(setMine)} />
      )}

      {view === "list" && (
      <>
      <div className="relative">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Najdi obec podle názvu…"
          className="w-full rounded-2xl border border-sand2 bg-warm px-3.5 py-2.5 text-sm focus:border-meadow-500 focus:outline-none"
        />
        {results.length > 0 && (
          <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-2xl border border-sand2 bg-card shadow-soft-md">
            {results.map((o) => (
              <button
                key={o.kod}
                type="button"
                onClick={() => add([o])}
                className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-sm hover:bg-cream-warm"
              >
                <span className="min-w-0 truncate">
                  <span className="font-semibold text-ink-900">{o.nazev}</span>
                  {krajFor(o.okres) && (
                    <span className="ml-1.5 text-xs text-ink-400">{krajFor(o.okres)}</span>
                  )}
                </span>
                <span className="shrink-0 text-xs font-bold text-meadow-700">+ přidat</span>
              </button>
            ))}
            {results.length >= 2 && (
              <button
                type="button"
                onClick={() => add(results)}
                className="w-full border-t border-sand2 bg-cream-warm px-3.5 py-2 text-center text-xs font-bold text-meadow-700 hover:bg-cream"
              >
                Přidat všech {results.length} výsledků
              </button>
            )}
          </div>
        )}
      </div>

      {msg && (
        <div className="rounded-2xl bg-peach-100 px-3.5 py-2 text-sm font-semibold text-terracotta-600">
          {msg}
        </div>
      )}

      <div>
        <div className="mb-2 text-sm font-bold text-ink-700">
          Vaše obce ({mine.length})
        </div>
        {mine.length === 0 ? (
          <p className="rounded-2xl bg-cream-warm p-4 text-sm text-ink-500">
            Zatím žádná obec. Najdi a přidej obce, které pokrýváš.
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {mine.map((o) => (
              <span
                key={o.kod}
                className="inline-flex items-center gap-1.5 rounded-pill bg-meadow-50 px-2.5 py-1 text-xs font-bold text-ink-900 ring-1 ring-meadow-500/30"
              >
                {o.nazev}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => remove(o.kod)}
                  className="text-ink-400 hover:text-terracotta-600 disabled:opacity-50"
                  aria-label={`Odebrat ${o.nazev}`}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
      </>
      )}
    </div>
  );
}
