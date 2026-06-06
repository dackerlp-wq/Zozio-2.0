"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { MapPin, Search, ShieldCheck } from "lucide-react";

import type { ShelterListItem } from "@/lib/shelters";

interface Props {
  shelters: ShelterListItem[];
  regions: string[];
}

export function ShelterDirectory({ shelters, regions }: Props) {
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState<string>("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shelters.filter((s) => {
      if (region && s.region !== region) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.city ?? "").toLowerCase().includes(q) ||
        (s.region ?? "").toLowerCase().includes(q)
      );
    });
  }, [shelters, query, region]);

  return (
    <>
      {/* Toolbar: hledání + filtr kraje + mapa */}
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <label className="flex min-w-[220px] flex-1 items-center gap-2.5 rounded-pill bg-card px-4 py-3 ring-1 ring-ink-900/8 focus-within:ring-terracotta-400">
          <Search className="size-4 shrink-0 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Hledat útulek nebo město…"
            className="w-full bg-transparent text-sm font-semibold text-ink-900 outline-none placeholder:text-ink-400"
          />
        </label>

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

        <Link
          href="/mapa"
          className="whitespace-nowrap text-sm font-bold text-terracotta-600 hover:text-terracotta-700"
        >
          📍 Zobrazit na mapě
        </Link>
      </div>

      {/* Grid karet */}
      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-cream-warm p-12 text-center text-ink-600">
          <div className="text-4xl">🔍</div>
          <p className="mt-3 font-semibold">Žádný útulek neodpovídá hledání.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => (
            <ShelterCard key={s.id} shelter={s} />
          ))}

          {/* Dlaždice „Váš útulek?" */}
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

function ShelterCard({ shelter: s }: { shelter: ShelterListItem }) {
  return (
    <Link
      href={`/utulek/${s.slug}`}
      className="group flex flex-col rounded-3xl bg-card p-6 ring-1 ring-ink-900/8 transition hover:-translate-y-1 hover:shadow-soft-lg"
    >
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
