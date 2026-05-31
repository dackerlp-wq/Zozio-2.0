import Image from "next/image";
import Link from "next/link";
import { MapPin, CalendarClock } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { SPECIES_LABEL } from "@/lib/format";
import { animalAgeLabel } from "@/lib/animal-age";
import type { Species } from "@/types/database";

export const metadata = {
  title: "Hledají svého páníčka — nalezená zvířata · Zozio",
  description:
    "Zvířata, která útulky nedávno našly a kterým běží zákonná ochranná lhůta. Poznáváte své zvíře? Ozvěte se útulku.",
};

interface FoundRow {
  id: string;
  name: string;
  species: Species;
  breed: string | null;
  age_years: number | null;
  age_months: number | null;
  birth_date: string | null;
  primary_photo_url: string | null;
  found_location: string | null;
  found_date: string | null;
  protection_until: string | null;
  institution: { name: string; city: string | null } | null;
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

export default async function FoundAnimalsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("animals")
    .select(
      `id, name, species, breed, age_years, age_months, birth_date,
       primary_photo_url, found_location, found_date, protection_until,
       institution:institutions!inner(name, city, is_published)`,
    )
    .eq("found_listing_published", true)
    .eq("legal_status", "in_protection")
    .in("intake_type", ["found", "confiscation"])
    .eq("institutions.is_published", true)
    .order("found_date", { ascending: false, nullsFirst: false })
    .limit(200);

  const animals = (data ?? []) as unknown as FoundRow[];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="max-w-2xl">
        <div className="font-mono text-xs uppercase tracking-wider text-meadow-700">
          Nalezená zvířata
        </div>
        <h1 className="mt-2 font-display text-4xl font-bold leading-tight text-ink-900 sm:text-5xl">
          Hledají svého páníčka
        </h1>
        <p className="mt-4 text-ink-700">
          Tato zvířata útulky nedávno našly a běží jim zákonná ochranná lhůta,
          během které se může přihlásit původní majitel.{" "}
          <strong>Nejsou nabízena k adopci</strong> — pokud v některém poznáváte
          své ztracené zvíře, co nejdřív kontaktujte příslušný útulek.
        </p>
      </header>

      {animals.length === 0 ? (
        <div className="mt-12 rounded-3xl bg-cream p-10 text-center ring-1 ring-ink-900/8">
          <div className="text-4xl">🐾</div>
          <h2 className="mt-3 font-display text-xl font-bold text-ink-900">
            Právě teď tu žádné nalezené zvíře není
          </h2>
          <p className="mt-2 text-ink-600">
            To je dobrá zpráva — žádnému zvířeti zrovna neběží ochranná lhůta.
          </p>
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {animals.map((a) => {
            const until = fmtDate(a.protection_until);
            const found = fmtDate(a.found_date);
            return (
              <Link
                key={a.id}
                href={`/nalezenci/${a.id}`}
                className="group relative block overflow-hidden rounded-2xl bg-card shadow-soft-sm ring-1 ring-ink-900/5 transition-shadow hover:shadow-soft-lg hover:ring-meadow-300/60"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-cream-warm">
                  {a.primary_photo_url ? (
                    <Image
                      src={a.primary_photo_url}
                      alt={a.name}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex size-full items-center justify-center text-5xl">
                      🐾
                    </div>
                  )}
                  <div className="absolute left-3 top-3">
                    <span className="rounded-pill bg-sunshine-200 px-3 py-1 text-xs font-semibold text-sunshine-600">
                      V ochranné lhůtě
                    </span>
                  </div>
                </div>

                <div className="space-y-3 p-5">
                  <div className="space-y-1">
                    <h3 className="font-display text-2xl font-semibold leading-tight text-ink-900">
                      {a.name}
                    </h3>
                    <p className="text-sm text-ink-600">
                      {a.breed || SPECIES_LABEL[a.species] || "Zvíře"} ·{" "}
                      {animalAgeLabel(a)}
                    </p>
                  </div>

                  <dl className="space-y-1.5 text-sm text-ink-700">
                    {a.found_location && (
                      <div className="flex items-start gap-1.5">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-ink-400" />
                        <span>
                          Nalezeno: {a.found_location}
                          {found ? ` (${found})` : ""}
                        </span>
                      </div>
                    )}
                    {until && (
                      <div className="flex items-start gap-1.5">
                        <CalendarClock className="mt-0.5 size-4 shrink-0 text-ink-400" />
                        <span>Lhůta do {until}</span>
                      </div>
                    )}
                  </dl>

                  {a.institution?.name && (
                    <p className="truncate text-xs text-ink-400">
                      {a.institution.name}
                      {a.institution.city ? ` · ${a.institution.city}` : ""}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
