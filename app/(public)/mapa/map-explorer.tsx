"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { type MapData, type MapShelter } from "@/lib/municipalities";

type ObecFeature = GeoJSON.Feature<
  GeoJSON.Geometry,
  { kod: number; nazev: string; okres: number; area?: number }
>;

interface Props {
  data: MapData;
}

function ringArea(ring: GeoJSON.Position[]): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(a / 2);
}

function polyArea(geom: GeoJSON.Geometry): number {
  if (geom.type === "Polygon") return ringArea(geom.coordinates[0] ?? []);
  if (geom.type === "MultiPolygon")
    return geom.coordinates.reduce((s, poly) => s + ringArea(poly[0] ?? []), 0);
  return 0;
}

/** Ohraničení (bbox) skupiny features pro přiblížení mapy. */
function bboxOf(features: ObecFeature[]): maplibregl.LngLatBoundsLike | null {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  const visit = (coords: GeoJSON.Position[]) => {
    for (const [x, y] of coords) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  };
  for (const f of features) {
    const g = f.geometry;
    if (g.type === "Polygon") g.coordinates.forEach(visit);
    else if (g.type === "MultiPolygon") g.coordinates.forEach((p) => p.forEach(visit));
  }
  if (minX === Infinity) return null;
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

function centroid(geom: GeoJSON.Geometry): [number, number] | null {
  let ring: GeoJSON.Position[] | null = null;
  if (geom.type === "Polygon") ring = geom.coordinates[0];
  else if (geom.type === "MultiPolygon") ring = geom.coordinates[0]?.[0] ?? null;
  if (!ring || ring.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p[0];
    y += p[1];
  }
  return [x / ring.length, y / ring.length];
}

const EMPTY_FC: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [] };

export function MapExplorer({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const obceRef = useRef<ObecFeature[] | null>(null);
  const obcePromiseRef = useRef<Promise<ObecFeature[]> | null>(null);
  const czBoundsRef = useRef<maplibregl.LngLatBoundsLike | null>(null);

  const [ready, setReady] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<{ kod: number; nazev: string; okres: number }[]>([]);
  const [krajMap, setKrajMap] = useState<Record<number, string>>({});
  const [findResult, setFindResult] = useState<{ obec: string; shelter: MapShelter | null } | null>(
    null,
  );

  const shelterById = useMemo(() => {
    const m: Record<string, MapShelter> = {};
    for (const s of data.shelters) m[s.id] = s;
    return m;
  }, [data.shelters]);

  // Číselník okres → kraj (pro našeptávač).
  useEffect(() => {
    fetch("/geo/okresy-kraje.json")
      .then((r) => r.json())
      .then(setKrajMap)
      .catch(() => setKrajMap({}));
  }, []);

  const krajShort = (okres: number) =>
    (krajMap[okres] ?? "").replace(/\s*kraj$/i, "");

  /** Líné načtení GeoJSONu obcí (až při první interakci). */
  function loadObce(): Promise<ObecFeature[]> {
    if (obceRef.current) return Promise.resolve(obceRef.current);
    if (obcePromiseRef.current) return obcePromiseRef.current;
    const p = fetch("/geo/obce-cz.min.geojson")
      .then((r) => r.json() as Promise<GeoJSON.FeatureCollection>)
      .then((gj) => {
        const feats = gj.features as ObecFeature[];
        for (const f of feats) f.properties.area = polyArea(f.geometry);
        obceRef.current = feats;
        return feats;
      })
      .catch(() => {
        obceRef.current = [];
        return [];
      });
    obcePromiseRef.current = p;
    return p;
  }

  /** Zobrazí spádovou oblast vybraného útulku (jen jeho obce) + přiblíží. */
  async function showTerritory(id: string) {
    const map = mapRef.current;
    if (!map) return;
    const feats = await loadObce();
    if (mapRef.current !== map) return;
    const owned = feats.filter((f) => data.obecOwner[f.properties.kod] === id);
    const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: owned };
    const src = map.getSource("terr") as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData(fc);
    const labSrc = map.getSource("terr-lab") as maplibregl.GeoJSONSource | undefined;
    if (labSrc) labSrc.setData(fc);
    const bounds = bboxOf(owned);
    if (bounds) map.fitBounds(bounds, { padding: 60, maxZoom: 11, duration: 700 });
  }

  function selectShelter(id: string) {
    setSelectedId(id);
    setFindResult(null);
    void showTerritory(id);
  }

  function clearSelection() {
    setSelectedId(null);
    const map = mapRef.current;
    const src = map?.getSource("terr") as maplibregl.GeoJSONSource | undefined;
    src?.setData(EMPTY_FC);
    const labSrc = map?.getSource("terr-lab") as maplibregl.GeoJSONSource | undefined;
    labSrc?.setData(EMPTY_FC);
    if (map && czBoundsRef.current) map.fitBounds(czBoundsRef.current, { padding: 24, duration: 600 });
  }

  // Inicializace mapy: vždy viditelná lehká vrstva krajů (obrys ČR) + prázdná
  // vrstva pro spádovou oblast vybraného útulku (obce se načtou líně).
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let cancelled = false;
    let map: maplibregl.Map | null = null;

    (async () => {
      let kraje: GeoJSON.FeatureCollection = EMPTY_FC;
      try {
        const r = await fetch("/geo/kraje-cz.geojson");
        kraje = (await r.json()) as GeoJSON.FeatureCollection;
      } catch {
        /* base bez krajů */
      }
      if (cancelled || !containerRef.current || mapRef.current) return;
      czBoundsRef.current = bboxOf(kraje.features as ObecFeature[]);

      map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          glyphs: "/geo/fonts/{fontstack}/{range}.pbf",
          sources: {
            kraje: { type: "geojson", data: kraje },
            terr: { type: "geojson", data: EMPTY_FC },
            "terr-lab": { type: "geojson", data: EMPTY_FC },
          },
          layers: [
            { id: "bg", type: "background", paint: { "background-color": "#FDF6EC" } },
            { id: "kraje-fill", type: "fill", source: "kraje", paint: { "fill-color": "#F3E7D2", "fill-opacity": 0.7 } },
            { id: "kraje-line", type: "line", source: "kraje", paint: { "line-color": "#E0CDA9", "line-width": 1 } },
            { id: "terr-fill", type: "fill", source: "terr", paint: { "fill-color": "#E8634A", "fill-opacity": 0.34 } },
            { id: "terr-line", type: "line", source: "terr", paint: { "line-color": "#FFFFFF", "line-width": 1 } },
            {
              id: "terr-labels",
              type: "symbol",
              source: "terr-lab",
              layout: {
                "text-field": ["get", "nazev"],
                "text-font": ["Noto Sans Regular"],
                "text-size": ["interpolate", ["linear"], ["zoom"], 7, 10, 10, 12, 13, 14],
                "symbol-sort-key": ["*", ["get", "area"], -1],
                "text-allow-overlap": false,
                "text-padding": 4,
                "text-max-width": 8,
              },
              paint: { "text-color": "#3A2A1D", "text-halo-color": "#FDF6EC", "text-halo-width": 1.4 },
            },
          ],
        },
        center: [15.4, 49.82],
        zoom: 6.7,
        attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
      const m = map;
      const onLoad = () => {
        // Výchozí pohled = celá ČR (přizpůsobí se velikosti kontejneru).
        if (czBoundsRef.current) m.fitBounds(czBoundsRef.current, { padding: 24, animate: false });
        setReady(true);
      };
      if (map.loaded()) onLoad();
      else map.on("load", onLoad);
    })();

    return () => {
      cancelled = true;
      if (map) map.remove();
      mapRef.current = null;
    };
  }, []);

  // Piny útulků.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    for (const s of data.shelters) {
      if (s.lat == null || s.lng == null) continue;
      const el = document.createElement("button");
      el.type = "button";
      el.setAttribute("aria-label", s.name);
      el.style.cssText = "cursor:pointer;background:none;border:none;font-size:24px;line-height:1";
      el.textContent = "📍";
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        selectShelter(s.id);
      });
      const marker = new maplibregl.Marker({ element: el }).setLngLat([s.lng, s.lat]).addTo(map);
      markersRef.current.push(marker);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, data.shelters]);

  // Našeptávač obcí (líně načte data při psaní).
  function updateSuggestions(value: string) {
    setQuery(value);
    const q = value.trim().toLowerCase();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    void loadObce().then((feats) => {
      const seen = new Set<string>();
      const list: { kod: number; nazev: string; okres: number }[] = [];
      for (const f of feats) {
        const n = f.properties.nazev;
        if (!n.toLowerCase().includes(q) || seen.has(n)) continue;
        seen.add(n);
        list.push({ kod: f.properties.kod, nazev: n, okres: f.properties.okres });
        if (list.length >= 8) break;
      }
      list.sort((a, b) => {
        const ax = a.nazev.toLowerCase() === q ? 0 : a.nazev.toLowerCase().startsWith(q) ? 1 : 2;
        const bx = b.nazev.toLowerCase() === q ? 0 : b.nazev.toLowerCase().startsWith(q) ? 1 : 2;
        return ax - bx;
      });
      setSuggestions(list);
    });
  }

  async function selectObec(kod: number, nazev: string) {
    setQuery(nazev);
    setSuggestions([]);
    const owner = data.obecOwner[kod];
    const shelter = owner ? shelterById[owner] ?? null : null;
    if (shelter) {
      setSelectedId(shelter.id);
      setFindResult({ obec: nazev, shelter });
      await showTerritory(shelter.id);
      // Po zobrazení oblasti přiblížíme na hledanou obec.
      const feats = await loadObce();
      const m = feats.find((f) => f.properties.kod === kod);
      const c = m ? centroid(m.geometry) : null;
      if (c && mapRef.current) mapRef.current.flyTo({ center: c, zoom: 10, duration: 700 });
    } else {
      setFindResult({ obec: nazev, shelter: null });
      clearSelection();
      const feats = await loadObce();
      const m = feats.find((f) => f.properties.kod === kod);
      const c = m ? centroid(m.geometry) : null;
      if (c && mapRef.current) mapRef.current.flyTo({ center: c, zoom: 9.5, duration: 700 });
    }
  }

  function runFind() {
    if (suggestions.length > 0) {
      void selectObec(suggestions[0].kod, suggestions[0].nazev);
    }
  }

  const selected = selectedId ? shelterById[selectedId] : null;
  const selectedObce = selected
    ? data.coveredObce.filter((o) => o.institutionId === selected.id).map((o) => o.nazev)
    : [];

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      {/* MAPA */}
      <div className="relative overflow-hidden rounded-3xl bg-card ring-1 ring-ink-900/8">
        <div className="absolute inset-x-3 top-3 z-10 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-pill bg-card px-3.5 py-2 text-[13px] font-bold text-ink-700 ring-1 ring-ink-900/12 shadow-soft-sm">
            📍 Útulky
          </span>
          {selected && (
            <button
              type="button"
              onClick={clearSelection}
              className="inline-flex items-center gap-1.5 rounded-pill bg-card px-3.5 py-2 text-[13px] font-bold text-ink-600 ring-1 ring-ink-900/12 shadow-soft-sm hover:text-terracotta-600"
            >
              ✕ Zrušit výběr
            </button>
          )}
        </div>
        <div ref={containerRef} className="h-[460px] w-full sm:h-[560px]" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-cream/60 text-sm font-semibold text-ink-500">
            Načítám mapu…
          </div>
        )}
      </div>

      {/* SIDEBAR */}
      <aside className="flex flex-col gap-4">
        <div className="rounded-3xl bg-card p-5 ring-1 ring-ink-900/8">
          <h3 className="font-display text-base font-bold text-ink-900">Kdo pokrývá tvou obec?</h3>
          <div className="relative mt-3 flex gap-2">
            <input
              value={query}
              onChange={(e) => updateSuggestions(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runFind()}
              placeholder="Zadej obec, např. Kladno"
              className="w-full rounded-xl bg-cream-warm px-3 py-2.5 text-sm font-semibold text-ink-900 ring-1 ring-ink-900/10 outline-none placeholder:text-ink-400 focus:ring-terracotta-400"
            />
            <button
              type="button"
              onClick={runFind}
              aria-label="Hledat obec"
              className="shrink-0 rounded-xl bg-terracotta-500 px-3.5 text-sm font-bold text-cream hover:bg-terracotta-600"
            >
              🔍
            </button>
            {suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-xl bg-card ring-1 ring-ink-900/12 shadow-soft-md">
                {suggestions.map((s) => {
                  const owner = data.obecOwner[s.kod];
                  const sh = owner ? shelterById[owner] : null;
                  return (
                    <button
                      key={s.kod}
                      type="button"
                      onClick={() => selectObec(s.kod, s.nazev)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-cream-warm"
                    >
                      <span className="min-w-0 truncate">
                        <span className="font-semibold text-ink-900">{s.nazev}</span>
                        {krajShort(s.okres) && (
                          <span className="ml-1.5 text-xs text-ink-400">{krajShort(s.okres)}</span>
                        )}
                      </span>
                      <span className="shrink-0 text-[11px] font-bold text-ink-400">
                        {sh ? sh.name : "nepokryto"}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {findResult && (
            <div className="mt-3 rounded-2xl bg-peach-100 p-3 text-sm">
              {findResult.shelter ? (
                <>
                  <div className="font-bold text-terracotta-600">🏠 {findResult.shelter.name}</div>
                  <div className="mt-0.5 text-xs font-semibold text-ink-600">
                    Pokrývá obec {findResult.obec}.
                  </div>
                </>
              ) : (
                <div className="font-semibold text-ink-600">
                  Obec <b>{findResult.obec}</b> zatím nemá přiřazený útulek.
                </div>
              )}
            </div>
          )}
        </div>

        {selected ? (
          <div className="rounded-3xl bg-card p-5 ring-1 ring-ink-900/8">
            {selected.isVerified && (
              <span className="inline-block rounded-pill bg-fern-100 px-2.5 py-0.5 text-[11px] font-bold text-fern-700">
                ✓ Ověřený útulek
              </span>
            )}
            <div className="mt-1.5 font-display text-lg font-bold text-ink-900">{selected.name}</div>
            <div className="text-[13px] font-semibold text-ink-500">
              📍 {selected.city ?? selected.region ?? "—"} · {selected.animalCount} zvířat k adopci
            </div>
            <div className="mt-2.5 rounded-2xl bg-cream-warm p-3 text-[13px] font-semibold text-ink-600">
              <b className="text-ink-900">Spádová oblast ({selected.obecCount} obcí):</b>{" "}
              {selectedObce.length === 0
                ? "zatím nenastaveno."
                : selectedObce.slice(0, 6).join(", ") +
                  (selectedObce.length > 6 ? ` … a ${selectedObce.length - 6} dalších.` : ".")}
            </div>
            <div className="mt-3 flex gap-2">
              <Link
                href={`/adopt?shelter=${selected.id}`}
                className="flex-1 rounded-pill bg-terracotta-500 px-3 py-2.5 text-center text-[13px] font-bold text-cream hover:bg-terracotta-600"
              >
                Zobrazit zvířata
              </Link>
              <Link
                href={`/utulek/${selected.slug}`}
                className="rounded-pill bg-card px-3.5 py-2.5 text-[13px] font-bold text-ink-700 ring-1 ring-ink-900/12 hover:ring-ink-900/25"
              >
                Profil →
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl bg-cream-warm p-5 text-sm font-semibold text-ink-500 ring-1 ring-ink-900/8">
            Klikni na pin útulku nebo najdi obec — zobrazí se spádová oblast daného útulku.
          </div>
        )}

        <div className="rounded-3xl bg-card p-5 ring-1 ring-ink-900/8">
          <h3 className="mb-3 font-display text-base font-bold text-ink-900">Útulky v síti</h3>
          <div className="flex flex-col gap-1">
            {data.shelters.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => selectShelter(s.id)}
                className={
                  "flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-left text-[13px] font-bold transition " +
                  (selectedId === s.id
                    ? "bg-peach-100 text-terracotta-600"
                    : "text-ink-700 hover:bg-cream-warm")
                }
              >
                <span className="text-base leading-none">📍</span>
                <span className="min-w-0 truncate">{s.name}</span>
                {s.obecCount > 0 && (
                  <span className="ml-auto shrink-0 text-xs font-semibold text-ink-400">
                    {s.obecCount} obcí
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl bg-card p-5 ring-1 ring-ink-900/8">
          <h3 className="mb-2 font-display text-base font-bold text-ink-900">Jak to funguje</h3>
          <p className="text-xs font-semibold leading-relaxed text-ink-500">
            Na mapě jsou <b className="text-ink-700">útulky jako piny</b>. Po kliknutí na útulek (nebo
            když najdeš obec) se zobrazí jeho <b className="text-ink-700">spádová oblast</b> — obce,
            které pokrývá. Hranice se skládají z oficiálních hranic obcí (RÚIAN).
          </p>
        </div>
      </aside>
    </div>
  );
}
