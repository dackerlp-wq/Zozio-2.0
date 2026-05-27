"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";

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
  tags?: string[];
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
        <Image
          src={animal.photoUrl}
          alt={animal.name}
          fill
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />

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
