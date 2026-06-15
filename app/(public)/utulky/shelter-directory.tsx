"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Search, ShieldCheck, X } from "lucide-react";

import type { ShelterListItem } from "@/lib/shelters";

interface Props {
  shelters: ShelterListItem[];
  regions: string[];
  obecOwner: Record<number, string>;
}

interface ObecPoint {
  k: number;
  n: string;
  o: number;
  x: number;
  y: number;
}

interface SelectedObec {
  kod: number;
  nazev: string;
  x: number;
  y: number;
}

function distanceKm(aLng: number, aLat: number, bLng: number, bLat: number): number {
  const R = 6371;
  const d = Math.PI / 180;
  const dLat = (bLat - aLat) * d;
  const dLng = (bLng - aLng) * d;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aLat * d) * Math.cos(bLat * d) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function ShelterDirectory({ shelters, regions, obecOwner }: Props) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string>("");
  const [suggestions, setSuggestions] = useState<ObecPoint[]>([]);
  const [selectedObec, setSelectedObec] = useState<SelectedObec | null>(null);
  const pointsRef = useRef<ObecPoint[] | null>(null);
  const pointsPromiseRef = useRef<Promise<ObecPoint[]> | null>(null);

  function loadPoints(): Promise<ObecPoint[]> {
    if (pointsRef.current) return Promise.resolve(pointsRef.current);
    if (pointsPromiseRef.current) return pointsPromiseRef.current;
    const p = fetch("/geo/obce-points.json")
      .then((r) => r.json() as Promise<ObecPoint[]>)
      .then((pts) => {
        pointsRef.current = pts;
        return pts;
      })
      .catch(() => {
        pointsRef.current = [];
        return [];
      });
    pointsPromiseRef.current = p;
    return p;
  }

  function onType(value: string) {
    setQuery(value);
    setSelectedObec(null);
    const q = value.trim().toLowerCase();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    void loadPoints().then((pts) => {
      const seen = new Set<string>();
      const list: ObecPoint[] = [];
      for (const p of pts) {
        if (!p.n.toLowerCase().includes(q) || seen.has(p.n)) continue;
        seen.add(p.n);
        list.push(p);
        if (list.length >= 8) break;
      }
      list.sort((a, b) => {
        const ax = a.n.toLowerCase() === q ? 0 : a.n.toLowerCase().startsWith(q) ? 1 : 2;
        const bx = b.n.toLowerCase() === q ? 0 : b.n.toLowerCase().startsWith(q) ? 1 : 2;
        return ax - bx;
      });
      setSuggestions(list);
    });
  }

  function pickObec(p: ObecPoint) {
    setSelectedObec({ kod: p.k, nazev: p.n, x: p.x, y: p.y });
    setQuery(p.n);
    setSuggestions([]);
  }

  function clearObec() {
    setSelectedObec(null);
    setQuery("");
    setSuggestions([]);
  }

  // Útulek pokrývající vybranou obec.
  const coveringId = selectedObec ? obecOwner[selectedObec.kod] : undefined;

  // Útulky seřazené: při vybrané obci dle vzdálenosti (pokrývající první),
  // jinak klasický filtr podle názvu/města/kraje.
  const ranked = useMemo(() => {
    if (selectedObec) {
      const withDist = shelters.map((s) => {
        const dist =
          s.lat != null && s.lng != null
            ? distanceKm(selectedObec.x, selectedObec.y, s.lng, s.lat)
            : Infinity;
        return { s, dist, covers: s.id === coveringId };
      });
      withDist.sort((a, b) => {
        if (a.covers !== b.covers) return a.covers ? -1 : 1;
        return a.dist - b.dist;
      });
      return withDist;
    }
    const q = query.trim().toLowerCase();
    return shelters
      .filter((s) => {
        if (region && s.region !== region) return false;
        if (!q) return true;
        return (
          s.name.toLowerCase().includes(q) ||
          (s.city ?? "").toLowerCase().includes(q) ||
          (s.region ?? "").toLowerCase().includes(q)
        );
      })
      .map((s) => ({ s, dist: Infinity, covers: false }));
  }, [shelters, query, region, selectedObec, coveringId]);

  const covering = coveringId ? shelters.find((s) => s.id === coveringId) ?? null : null;

  return (
    <>
      {/* Toolbar: hledání + filtr kraje + mapa */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <label className="flex items-center gap-2.5 rounded-pill bg-card px-4 py-3 ring-1 ring-ink-900/8 focus-within:ring-terracotta-400">
            <Search className="size-4 shrink-0 text-ink-400" />
            <input
              value={query}
              onChange={(e) => onType(e.target.value)}
              placeholder="Hledat útulek nebo zadej své město…"
              className="w-full bg-transparent text-sm font-semibold text-ink-900 outline-none placeholder:text-ink-400"
            />
            {(query || selectedObec) && (
              <button type="button" onClick={clearObec} aria-label="Vymazat" className="text-ink-400 hover:text-terracotta-600">
                <X className="size-4" />
              </button>
            )}
          </label>
          {suggestions.length > 0 && (
            <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-72 overflow-auto rounded-2xl bg-card ring-1 ring-ink-900/12 shadow-soft-md">
              {suggestions.map((p) => {
                const owner = obecOwner[p.k];
                const sh = owner ? shelters.find((s) => s.id === owner) : null;
                return (
                  <button
                    key={p.k}
                    type="button"
                    onClick={() => pickObec(p)}
                    className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm hover:bg-cream-warm"
                  >
                    <span className="font-semibold text-ink-900">{p.n}</span>
                    <span className="shrink-0 text-[11px] font-bold text-ink-400">
                      {sh ? sh.name : "nepokryto — najdu nejbližší"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!selectedObec && (
          <div className="flex flex-wrap gap-2">
            <RegionChip active={region === ""} onClick={() => setRegion("")}>
              Vše
            </RegionChip>
            {regions.map((r) => (
              <RegionChip key={r} active={region === r} onClick={() => setRegion(r)}>
                {r}
              </RegionChip>
            ))}
          </div>
        )}

        <Link
          href="/mapa"
          className="whitespace-nowrap text-sm font-bold text-terracotta-600 hover:text-terracotta-700"
        >
          📍 Zobrazit na mapě
        </Link>
      </div>

      {/* Výsledek hledání podle obce */}
      {selectedObec && (
        <div className="mb-6 rounded-3xl bg-peach-100 p-5 ring-1 ring-terracotta-400/30">
          {covering ? (
            <p className="text-sm font-semibold text-ink-700">
              Obec <b className="text-ink-900">{selectedObec.nazev}</b> pokrývá útulek{" "}
              <Link href={`/utulek/${covering.slug}`} className="font-bold text-terracotta-600">
                {covering.name}
              </Link>
              . Níže jsou i další nejbližší útulky.
            </p>
          ) : (
            <p className="text-sm font-semibold text-ink-700">
              Obec <b className="text-ink-900">{selectedObec.nazev}</b> zatím nemá přiřazený útulek —
              tady jsou <b className="text-ink-900">nejbližší</b> útulky podle vzdálenosti.
            </p>
          )}
        </div>
      )}

      {/* Grid karet */}
      {ranked.length === 0 ? (
        <div className="rounded-3xl bg-cream-warm p-12 text-center text-ink-600">
          <div className="text-4xl">🔍</div>
          <p className="mt-3 font-semibold">Žádný útulek neodpovídá hledání.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {ranked.map(({ s, dist, covers }) => (
            <ShelterCard
              key={s.id}
              shelter={s}
              covers={covers}
              distanceKm={selectedObec && dist !== Infinity ? dist : null}
            />
          ))}

          {/* Dlaždice „Váš útulek?" — jen v běžném výpisu */}
          {!selectedObec && (
            <Link
              href="/auth/register"
              className="flex flex-col items-center justify-center rounded-3xl border-2 border-dashed border-ink-900/15 bg-cream-warm p-6 text-center transition hover:border-terracotta-400 hover:bg-cream"
            >
              <div className="text-3xl">➕</div>
              <div className="mt-2 font-display text-lg font-bold text-ink-900">Váš útulek?</div>
              <p className="mt-1 text-sm text-ink-600">
                Přidejte se do sítě Zozio a najděte zvířatům domov.
              </p>
            </Link>
          )}
        </div>
      )}

      {/* CTA pruh */}
      <div className="mt-8 flex flex-wrap items-center gap-6 rounded-3xl bg-ink-900 p-7 text-cream">
        <div className="min-w-[240px] flex-1">
          <h3 className="font-display text-2xl font-bold">Jste útulek?</h3>
          <p className="mt-1 text-sm text-cream/80">
            Veďte evidenci, zveřejněte zvířata a najděte jim domov — základ zdarma.
          </p>
        </div>
        <Link
          href="/auth/register"
          className="rounded-pill bg-terracotta-500 px-6 py-3.5 text-sm font-bold text-cream shadow-soft-md transition hover:bg-terracotta-600"
        >
          Přidat útulek do Zozio
        </Link>
      </div>
    </>
  );
}

function RegionChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "rounded-pill bg-ink-900 px-3.5 py-2 text-sm font-bold text-cream"
          : "rounded-pill bg-card px-3.5 py-2 text-sm font-bold text-ink-700 ring-1 ring-ink-900/10 transition hover:ring-ink-900/25"
      }
    >
      {children}
    </button>
  );
}

function ShelterCard({
  shelter: s,
  covers,
  distanceKm,
}: {
  shelter: ShelterListItem;
  covers?: boolean;
  distanceKm?: number | null;
}) {
  return (
    <Link
      href={`/utulek/${s.slug}`}
      className={
        "group flex flex-col rounded-3xl bg-card p-6 ring-1 transition hover:-translate-y-1 hover:shadow-soft-lg " +
        (covers ? "ring-2 ring-terracotta-400" : "ring-ink-900/8")
      }
    >
      {covers && (
        <span className="mb-3 inline-flex w-fit items-center gap-1 rounded-pill bg-terracotta-500 px-2.5 py-0.5 text-[11px] font-bold text-cream">
          <MapPin className="size-3" /> Pokrývá vaši obec
        </span>
      )}
      <div className="flex items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-cream-warm ring-1 ring-ink-900/8">
          {s.logo_url ? (
            <Image src={s.logo_url} alt={s.name} width={56} height={56} className="size-full object-cover" />
          ) : (
            <span className="text-2xl">🏡</span>
          )}
        </div>
        <div className="min-w-0">
          {s.is_verified && (
            <span className="mb-1 inline-flex items-center gap-1 rounded-pill bg-fern-100 px-2.5 py-0.5 text-[11px] font-bold text-fern-700 ring-1 ring-inset ring-fern-600/30">
              <ShieldCheck className="size-3" /> Ověřeno
            </span>
          )}
          <div className="truncate font-display text-lg font-bold leading-tight text-ink-900">{s.name}</div>
          {(s.city || s.region) && (
            <div className="mt-0.5 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-500">
              <MapPin className="size-3.5" /> {s.city ?? s.region}
              {distanceKm != null && (
                <span className="text-ink-400">· {Math.round(distanceKm)} km</span>
              )}
            </div>
          )}
        </div>
      </div>

      {s.description && (
        <p className="mt-4 line-clamp-2 flex-1 text-sm leading-relaxed text-ink-600">{s.description}</p>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-ink-900/8 pt-3.5">
        <span className="text-sm font-bold text-terracotta-600">
          {s.availableCount === 1 ? "1 zvíře k adopci" : `${s.availableCount} zvířat k adopci`}
        </span>
        {s.urgentCount > 0 && (
          <span className="rounded-pill bg-peach-200 px-2.5 py-1 text-xs font-bold text-terracotta-600">
            {s.urgentCount} naléhá
          </span>
        )}
      </div>
    </Link>
  );
}
