"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Lock } from "lucide-react";

import { cn } from "@/lib/utils";
import { TAB_LABEL, type TabLayout } from "@/lib/animal-tabs-layout";

/** Tři kotvy se vždy renderují jako neutrální. */
const CORE = new Set(["", "profil", "historie"]);

export function AnimalTabs({
  animalId,
  layout,
}: {
  animalId: string;
  layout: TabLayout[];
}) {
  const pathname = usePathname();
  const base = `/admin/animals/${animalId}`;
  const [moreOpen, setMoreOpen] = useState(false);

  const href = (seg: string) => (seg ? `${base}/${seg}` : base);
  const isActive = (seg: string) =>
    seg ? pathname === href(seg) || pathname.startsWith(`${href(seg)}/`) : pathname === base;

  const inline = layout.filter(
    (t) => t.state !== "hidden" && t.state !== "overflow",
  );
  const overflow = layout.filter((t) => t.state === "overflow");

  const Dot = ({
    urgent,
    onPrimary,
  }: {
    urgent?: boolean;
    onPrimary?: boolean;
  }) =>
    urgent ? (
      <span
        className={cn(
          "size-2 rounded-full",
          onPrimary ? "bg-cream" : "bg-meadow-600",
        )}
        aria-label="vyžaduje pozornost"
      />
    ) : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {inline.map((t) => {
        const active = isActive(t.tab);
        const label = TAB_LABEL[t.tab];
        const core = CORE.has(t.tab);

        if (t.state === "locked") {
          return (
            <Link
              key={t.tab || "overview"}
              href={href(t.tab)}
              title={t.reason}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-pill border-[1.5px] border-dashed px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap",
                active
                  ? "border-ink-900/30 bg-cream-warm text-ink-700"
                  : "border-ink-900/15 bg-cream text-ink-400 hover:text-ink-600",
              )}
            >
              <Lock className="size-3.5" />
              {label}
            </Link>
          );
        }

        const cls =
          t.state === "primary"
            ? "bg-meadow-500 text-cream shadow-sm hover:bg-meadow-700"
            : active
              ? "bg-ink-900 text-cream"
              : core
                ? "bg-cream-warm text-ink-700 hover:bg-sand"
                : "bg-cream text-ink-600 ring-1 ring-ink-900/10 hover:bg-cream-warm";

        return (
          <Link
            key={t.tab || "overview"}
            href={href(t.tab)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-pill px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap transition-colors",
              cls,
            )}
          >
            {label}
            <Dot urgent={t.attention === "urgent"} onPrimary={t.state === "primary"} />
          </Link>
        );
      })}

      {overflow.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setMoreOpen((v) => !v)}
            className="inline-flex items-center gap-1 rounded-pill border-[1.5px] border-dashed border-ink-900/20 px-3.5 py-1.5 text-sm font-semibold text-ink-500 hover:text-ink-700"
          >
            Více
            <ChevronDown className="size-4" />
            {overflow.some((t) => t.attention === "urgent") && (
              <span className="size-2 rounded-full bg-meadow-500" />
            )}
          </button>
          {moreOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMoreOpen(false)} />
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-lg bg-cream p-1.5 shadow-lg ring-1 ring-ink-900/10">
                {overflow.map((t) => (
                  <Link
                    key={t.tab}
                    href={href(t.tab)}
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm font-semibold hover:bg-cream-warm",
                      isActive(t.tab) ? "text-ink-900" : "text-ink-600",
                    )}
                  >
                    {TAB_LABEL[t.tab]}
                    <Dot urgent={t.attention === "urgent"} />
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
