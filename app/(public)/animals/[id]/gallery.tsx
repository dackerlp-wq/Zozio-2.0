"use client";

import { useState } from "react";
import Image from "next/image";

import { cn } from "@/lib/utils";

export function Gallery({
  photos,
  name,
  urgent,
}: {
  photos: string[];
  name: string;
  urgent?: boolean;
}) {
  const [active, setActive] = useState(0);

  if (photos.length === 0) {
    return (
      <div className="relative flex aspect-[4/3] items-center justify-center rounded-3xl bg-gradient-to-br from-cream-deeper to-cream-warm text-7xl">
        🐾
        {urgent && (
          <span className="absolute left-4 top-4 rounded-pill bg-terracotta-500 px-3.5 py-1.5 text-sm font-bold text-cream">
            Naléhá
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-cream-warm">
        <Image
          src={photos[active]}
          alt={name}
          fill
          sizes="(min-width: 1024px) 60vw, 100vw"
          priority
          className="object-cover"
        />
        {urgent && (
          <span className="absolute left-4 top-4 rounded-pill bg-terracotta-500 px-3.5 py-1.5 text-sm font-bold text-cream">
            Naléhá
          </span>
        )}
      </div>
      {photos.length > 1 && (
        <div className="flex flex-wrap gap-2.5">
          {photos.slice(0, 6).map((p, i) => (
            <button
              key={p}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "relative size-16 overflow-hidden rounded-xl bg-cream-warm ring-2 transition",
                i === active ? "ring-terracotta-500" : "ring-transparent hover:ring-terracotta-400/50",
              )}
            >
              <Image src={p} alt={`${name} ${i + 1}`} fill sizes="64px" className="object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
