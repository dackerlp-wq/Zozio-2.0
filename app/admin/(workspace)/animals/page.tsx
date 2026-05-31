import Link from "next/link";
import { ChevronDown, Plus, SlidersHorizontal } from "lucide-react";

import { ZozioButton } from "@/components/zozio/button";
import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ADOPTION_STATUS_LABEL,
  ADOPTION_STATUS_PILL,
  SPECIES_LABEL,
} from "@/lib/format";
import { animalAgeLabel } from "@/lib/animal-age";
import { cn } from "@/lib/utils";
import type {
  AdoptionStatus,
  AnimalIntakeType,
  AnimalLegalStatus,
  AnimalSupervisionStatus,
  Species,
} from "@/types/database";

import { AnimalRowActions } from "./row-actions";
import { AnimalSearch, type SearchItem } from "./animal-search";

/** Bez diakritiky, malá písmena. */
function normSearch(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export const metadata = { title: "Zvířata — Zozio Admin" };

interface PageProps {
  searchParams: Promise<{ filtr?: string }>;
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

interface FilterOption {
  key: string;
  label: string;
  match: (a: Row) => boolean;
}

interface FilterGroup {
  title: string;
  options: FilterOption[];
}

const FILTER_GROUPS: FilterGroup[] = [
  {
    title: "Stav adopce",
    options: [
      {
        key: "available",
        label: "K adopci",
        match: (a) => a.adoption_status === "available",
      },
      {
        key: "reserved",
        label: "Rezervováno",
        match: (a) => a.adoption_status === "reserved",
      },
      {
        key: "adopted",
        label: "Adoptováno",
        match: (a) => a.adoption_status === "adopted",
      },
      {
        key: "intake",
        label: "Příjem",
        match: (a) => a.adoption_status === "intake",
      },
    ],
  },
  {
    title: "Péče a stav",
    options: [
      { key: "urgent", label: "Naléhavé", match: (a) => a.is_urgent },
      { key: "long_stay", label: "Dlouho čeká", match: (a) => a.long_stay_boost },
      {
        key: "quarantine",
        label: "Karanténa / izolace",
        match: (a) =>
          a.supervision_status === "quarantine" ||
          a.supervision_status === "isolation",
      },
      {
        key: "foster",
        label: "Dočasná péče",
        match: (a) => a.adoption_status === "foster",
      },
      {
        key: "nalezenci",
        label: "V ochranné lhůtě",
        match: (a) => a.legal_status === "in_protection",
      },
    ],
  },
  {
    title: "Způsob příjmu",
    options: [
      {
        key: "intake_found",
        label: "Nalezené",
        match: (a) => a.intake_type === "found",
      },
      {
        key: "intake_confiscation",
        label: "Odebrané",
        match: (a) => a.intake_type === "confiscation",
      },
      {
        key: "intake_surrender",
        label: "Odevzdané",
        match: (a) => a.intake_type === "surrender",
      },
      {
        key: "intake_transfer",
        label: "Převzaté",
        match: (a) => a.intake_type === "transfer",
      },
    ],
  },
];

const FILTER_OPTIONS: Record<string, FilterOption> = Object.fromEntries(
  FILTER_GROUPS.flatMap((g) => g.options).map((o) => [o.key, o]),
);

interface Row {
  id: string;
  name: string;
  species: Species;
  breed: string | null;
  age_years: number | null;
  age_months: number | null;
  primary_photo_url: string | null;
  adoption_status: AdoptionStatus;
  is_urgent: boolean;
  legal_status: AnimalLegalStatus;
  found_listing_published: boolean;
  protection_until: string | null;
  long_stay_boost: boolean;
  supervision_status: AnimalSupervisionStatus;
  intake_type: AnimalIntakeType | null;
  chip_number: string | null;
  tattoo: string | null;
  ear_tag: string | null;
  record_number: string | null;
  kennel: { name: string } | null;
}

export default async function AnimalsAdminPage({ searchParams }: PageProps) {
  const { filtr = "" } = await searchParams;
  const activeFilter = FILTER_OPTIONS[filtr];
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const { data } = await supabase
    .from("animals")
    .select(
      "id, name, species, breed, age_years, age_months, birth_date, primary_photo_url, adoption_status, is_urgent, legal_status, found_listing_published, protection_until, long_stay_boost, supervision_status, intake_type, chip_number, tattoo, ear_tag, record_number, kennel:kennels(name)",
    )
    .eq("institution_id", institutionId)
    .order("created_at", { ascending: false });

  const all = (data ?? []) as unknown as Row[];
  const rows = activeFilter ? all.filter(activeFilter.match) : all;

  const searchItems: SearchItem[] = all.map((a) => {
    const ids = [a.chip_number, a.tattoo, a.ear_tag, a.record_number].filter(
      Boolean,
    ) as string[];
    const subtitle =
      [SPECIES_LABEL[a.species], a.breed, animalAgeLabel(a)]
        .filter(Boolean)
        .join(" · ") || "Zvíře";
    return {
      id: a.id,
      name: a.name,
      subtitle,
      photo: a.primary_photo_url,
      badge: a.kennel?.name ?? null,
      haystack: normSearch(
        [a.name, ...ids, a.kennel?.name ?? ""].join(" "),
      ),
    };
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
            {activeFilter ? activeFilter.label : "Zvířata"}
          </h2>
          <p className="mt-1 text-ink-600">{rows.length} celkem</p>
        </div>
        <ZozioButton asChild variant="meadow" size="md">
          <Link href="/admin/animals/new">
            <Plus /> Přidat zvíře
          </Link>
        </ZozioButton>
      </div>

      <AnimalSearch items={searchItems} />

      <details className="group rounded-3xl bg-cream/60 ring-1 ring-ink-900/8 [&[open]]:bg-cream">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-5 py-3 text-sm font-semibold text-ink-800">
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-meadow-600" />
            Filtry
            {activeFilter && (
              <span className="rounded-full bg-meadow-500 px-2 py-0.5 text-xs font-semibold text-cream">
                {activeFilter.label}
              </span>
            )}
          </span>
          <ChevronDown className="size-4 text-ink-400 transition-transform group-open:rotate-180" />
        </summary>
        <div className="space-y-3 px-5 pb-5">
        <div className="flex flex-wrap gap-2">
          <Link
            href="/admin/animals"
            className={cn(
              "rounded-pill px-4 py-1.5 text-sm font-semibold ring-1 transition",
              !activeFilter
                ? "bg-meadow-500 text-cream ring-meadow-500"
                : "bg-cream text-ink-700 ring-ink-900/10 hover:ring-meadow-300",
            )}
          >
            Všechna ({all.length})
          </Link>
        </div>
        {FILTER_GROUPS.map((group) => (
          <div key={group.title}>
            <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
              {group.title}
            </div>
            <div className="flex flex-wrap gap-2">
              {group.options.map((o) => {
                const count = all.filter(o.match).length;
                const active = filtr === o.key;
                return (
                  <Link
                    key={o.key}
                    href={`/admin/animals?filtr=${o.key}`}
                    className={cn(
                      "rounded-pill px-3.5 py-1.5 text-sm font-semibold ring-1 transition",
                      active
                        ? "bg-meadow-500 text-cream ring-meadow-500"
                        : count === 0
                          ? "bg-cream/60 text-ink-400 ring-ink-900/8"
                          : "bg-cream text-ink-700 ring-ink-900/10 hover:ring-meadow-300",
                    )}
                  >
                    {o.label} ({count})
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
        </div>
      </details>

      {rows.length === 0 ? (
        <div className="rounded-3xl bg-cream p-12 text-center ring-1 ring-ink-900/8">
          <div className="text-4xl">🐾</div>
          <h3 className="mt-4 font-display text-xl font-semibold text-ink-900">
            {activeFilter
              ? "Žádné zvíře v tomto filtru"
              : "Zatím žádná zvířata"}
          </h3>
          <p className="mt-2 text-ink-600">
            {activeFilter ? (
              <>
                Pro filtr „{activeFilter.label}" tu nic není.{" "}
                <Link
                  href="/admin/animals"
                  className="font-semibold text-meadow-700 hover:text-meadow-600"
                >
                  Zobrazit všechna
                </Link>
              </>
            ) : (
              "Přidej první zvíře a začni mu hledat domov."
            )}
          </p>
          {!activeFilter && (
            <ZozioButton asChild variant="meadow" size="md" className="mt-6">
              <Link href="/admin/animals/new">Přidat první zvíře</Link>
            </ZozioButton>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-cream ring-1 ring-ink-900/8">
          <ul className="divide-y divide-ink-900/8">
            {rows.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-4 p-4 hover:bg-sage-50"
              >
                <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-cream-warm">
                  {a.primary_photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={a.primary_photo_url}
                      alt={a.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-2xl">
                      🐾
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/admin/animals/${a.id}`}
                      className="font-display text-lg font-bold text-ink-900 hover:text-meadow-600"
                    >
                      {a.name}
                    </Link>
                    {a.is_urgent && (
                      <span className="rounded-full bg-terracotta-500 px-2 py-0.5 text-xs font-semibold text-cream">
                        Naléhá
                      </span>
                    )}
                    {a.legal_status === "in_protection" && (
                      <span
                        className="rounded-full bg-sunshine-200 px-2 py-0.5 text-xs font-semibold text-sunshine-600"
                        title={
                          a.found_listing_published
                            ? "Zveřejněno v katalogu nalezenců"
                            : "Nezveřejněno v katalogu nalezenců"
                        }
                      >
                        V ochranné lhůtě
                        {a.found_listing_published ? " · v katalogu" : ""}
                      </span>
                    )}
                  </div>
                  <div className="truncate text-sm text-ink-600">
                    {[
                      SPECIES_LABEL[a.species],
                      a.breed,
                      animalAgeLabel(a),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {a.legal_status === "in_protection" &&
                    fmtDate(a.protection_until) && (
                      <div className="truncate text-xs text-sunshine-600">
                        Ochranná lhůta do {fmtDate(a.protection_until)}
                      </div>
                    )}
                </div>

                <span
                  className={cn(
                    "hidden shrink-0 rounded-full px-3 py-1 text-xs font-semibold sm:inline",
                    ADOPTION_STATUS_PILL[a.adoption_status],
                  )}
                >
                  {ADOPTION_STATUS_LABEL[a.adoption_status]}
                </span>

                <AnimalRowActions id={a.id} name={a.name} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
