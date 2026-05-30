"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

interface Tab {
  segment: string;
  label: string;
}

const TABS: Tab[] = [
  { segment: "", label: "Přehled" },
  { segment: "profil", label: "Profil" },
  { segment: "prijem", label: "Příjem & právo" },
  { segment: "zdravi", label: "Zdraví" },
  { segment: "karantena", label: "Karanténa" },
  { segment: "pestoun", label: "Pěstoun" },
  { segment: "adopce", label: "Adopce" },
  { segment: "pece", label: "Péče" },
  { segment: "ustajeni", label: "Ustájení" },
  { segment: "evidence", label: "Náklady & události" },
  { segment: "ukoly", label: "Úkoly" },
  { segment: "historie", label: "Historie" },
];

export function AnimalTabs({ animalId }: { animalId: string }) {
  const pathname = usePathname();
  const base = `/admin/animals/${animalId}`;

  return (
    <div className="-mb-px flex gap-1 overflow-x-auto">
      {TABS.map((tab) => {
        const href = tab.segment ? `${base}/${tab.segment}` : base;
        const active = tab.segment
          ? pathname === href || pathname.startsWith(`${href}/`)
          : pathname === base;
        return (
          <Link
            key={tab.segment || "overview"}
            href={href}
            className={cn(
              "shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-semibold transition-colors",
              active
                ? "border-meadow-500 text-ink-900"
                : "border-transparent text-ink-500 hover:border-ink-900/15 hover:text-ink-700",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
