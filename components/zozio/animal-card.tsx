"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronDown, Heart, Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { ZozioBadge } from "./badge";

export interface AnimalCardData {
  id: string;
  name: string;
  species: "dog" | "cat" | "other";
  breed: string;
  ageLabel: string;
  city: string;
  shelterName: string;
  photoUrl: string;
  status: "available" | "reserved" | "adopted";
  isUrgent?: boolean;
  isLongStay?: boolean;
  isNew?: boolean;
  tags?: string[];
  /** AI matching (volitelné — jen v režimu „Doporučené pro tebe"). */
  matchScore?: number;
  matchTone?: "high" | "mid" | "low";
  matchReason?: { ok: boolean; text: string } | null;
  matchReasons?: { ok: boolean; text: string }[];
  /** Má zvíře dost vyplněných údajů pro spolehlivé skóre? */
  matchEnoughInfo?: boolean;
  /** Důležité chybějící údaje. */
  matchMissing?: string[];
}

interface AnimalCardProps {
  animal: AnimalCardData;
  href?: string;
  onFavoriteToggle?: (id: string, next: boolean) => void;
  initialFavorite?: boolean;
  className?: string;
}

export function AnimalCard({
  animal,
  href,
  onFavoriteToggle,
  initialFavorite = false,
  className,
}: AnimalCardProps) {
  const [favorited, setFavorited] = useState(initialFavorite);
  const [pulse, setPulse] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  const handleFav = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const next = !favorited;
    setFavorited(next);
    setPulse(true);
    onFavoriteToggle?.(animal.id, next);
    setTimeout(() => setPulse(false), 450);
  };

  const target = href ?? `/animals/${animal.id}`;

  return (
    <Link
      href={target}
      className={cn(
        "card-tilt group relative block overflow-hidden rounded-2xl bg-card shadow-soft-sm hover:shadow-soft-lg",
        "ring-1 ring-ink-900/5 hover:ring-meadow-300/60",
        className,
      )}
      aria-label={`${animal.name}, ${animal.breed}, ${animal.city}`}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-cream-warm">
        {animal.photoUrl ? (
          <Image
            src={animal.photoUrl}
            alt={animal.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-5xl">
            {animal.species === "cat" ? "🐱" : animal.species === "dog" ? "🐶" : "🐾"}
          </div>
        )}

        {/* Top-left status badges */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {animal.isUrgent && (
            <ZozioBadge variant="urgent" size="sm">
              Naléhá
            </ZozioBadge>
          )}
          {animal.isLongStay && !animal.isUrgent && (
            <ZozioBadge variant="longStay" size="sm">
              Dlouho čeká
            </ZozioBadge>
          )}
          {animal.isNew && !animal.isUrgent && !animal.isLongStay && (
            <ZozioBadge variant="fresh" size="sm">
              Nově
            </ZozioBadge>
          )}
          {animal.status === "reserved" && (
            <ZozioBadge variant="reserved" size="sm">
              Rezervováno
            </ZozioBadge>
          )}
          {animal.status === "adopted" && (
            <ZozioBadge variant="adopted" size="sm">
              Adoptováno
            </ZozioBadge>
          )}
        </div>

        {/* Match score (AI „Doporučené pro tebe") */}
        {typeof animal.matchScore === "number" &&
          (animal.matchEnoughInfo === false ? (
            <span className="absolute bottom-3 left-3 rounded-pill bg-cream/95 px-3 py-1.5 text-sm font-bold text-ink-600 shadow-soft-md backdrop-blur">
              ⓘ Málo informací
            </span>
          ) : (
            <span
              className={cn(
                "absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-pill px-3 py-1.5 font-display text-sm font-bold shadow-soft-md",
                animal.matchTone === "high"
                  ? "bg-fern-600 text-cream"
                  : animal.matchTone === "mid"
                    ? "bg-sunshine-400 text-ink-900"
                    : "bg-cream-deeper text-ink-700",
              )}
            >
              {animal.matchScore} % shoda
              {animal.matchMissing && animal.matchMissing.length > 0 && (
                <Info className="size-3.5 opacity-80" aria-label="Skóre z neúplných údajů" />
              )}
            </span>
          ))}

        {/* Favorite button */}
        <button
          type="button"
          onClick={handleFav}
          aria-label={favorited ? "Odebrat z oblíbených" : "Přidat do oblíbených"}
          aria-pressed={favorited}
          className={cn(
            "absolute right-3 top-3 inline-flex size-10 items-center justify-center rounded-full bg-cream/95 backdrop-blur shadow-soft-sm transition-all",
            "hover:bg-cream hover:scale-110 active:scale-95",
          )}
        >
          <Heart
            className={cn(
              "size-5 transition-colors",
              favorited ? "fill-berry text-berry" : "text-ink-600",
              pulse && "animate-heart-pulse",
            )}
          />
        </button>
      </div>

      <div className="space-y-3 p-5">
        <div className="space-y-1">
          <h3 className="font-display text-2xl font-semibold leading-tight tracking-tight text-ink-900">
            {animal.name}
          </h3>
          <p className="text-sm text-ink-600">
            {animal.breed} · {animal.ageLabel}
          </p>
        </div>

        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="truncate text-ink-700">
            <span className="text-ink-400">📍</span> {animal.city}
          </span>
          <span className="truncate text-xs text-ink-400">
            {animal.shelterName}
          </span>
        </div>

        {/* Hlavní řádek: u málo vyplněných zvířat řekneme, co chybí. */}
        {animal.matchEnoughInfo === false && animal.matchMissing && animal.matchMissing.length > 0 ? (
          <div className="rounded-xl bg-cream-warm px-3 py-2 text-xs font-bold text-ink-600">
            ⓘ Pro spolehlivé porovnání chybí: {animal.matchMissing.join(", ")}
          </div>
        ) : (
          <>
            {animal.matchReason && (
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold",
                  animal.matchReason.ok
                    ? "bg-fern-50 text-fern-700"
                    : "bg-sunshine-200/60 text-sunshine-600",
                )}
              >
                <span>{animal.matchReason.ok ? "✓" : "!"}</span>
                <span className="truncate">{animal.matchReason.text}</span>
              </div>
            )}
            {typeof animal.matchScore === "number" &&
              animal.matchMissing &&
              animal.matchMissing.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-400">
                  <Info className="size-3.5 shrink-0" />
                  <span>
                    −{animal.matchMissing.length * 10} % za neúplné údaje ({animal.matchMissing.length} chybí)
                  </span>
                </div>
              )}
          </>
        )}

        {typeof animal.matchScore === "number" &&
          ((animal.matchReasons && animal.matchReasons.length > 0) ||
            (animal.matchMissing && animal.matchMissing.length > 0)) && (
            <div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDetailOpen((v) => !v);
                }}
                aria-expanded={detailOpen}
                className="inline-flex items-center gap-1 text-xs font-bold text-meadow-700 hover:text-meadow-600"
              >
                {detailOpen ? "Skrýt detail shody" : "Detail shody"}
                <ChevronDown
                  className={cn("size-3.5 transition-transform", detailOpen && "rotate-180")}
                />
              </button>
              {detailOpen && (
                <ul className="mt-2 space-y-1.5">
                  {(animal.matchReasons ?? []).map((r, i) => (
                    <li
                      key={`r-${i}`}
                      className={cn(
                        "flex items-start gap-2 text-xs font-semibold",
                        r.ok ? "text-fern-700" : "text-sunshine-600",
                      )}
                    >
                      <span className="mt-px shrink-0">{r.ok ? "✓" : "!"}</span>
                      <span>{r.text}</span>
                    </li>
                  ))}
                  {(animal.matchMissing ?? []).map((m, i) => (
                    <li key={`m-${i}`} className="flex items-start gap-2 text-xs font-semibold text-ink-400">
                      <span className="mt-px shrink-0">ⓘ</span>
                      <span>{m} — útulek zatím neuvedl</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

        {animal.tags && animal.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {animal.tags.slice(0, 3).map((tag) => (
              <ZozioBadge key={tag} variant="soft" size="sm">
                {tag}
              </ZozioBadge>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}
