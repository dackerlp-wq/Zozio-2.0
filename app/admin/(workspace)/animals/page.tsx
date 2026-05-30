import Link from "next/link";
import { Plus } from "lucide-react";

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
import type { AdoptionStatus, Species } from "@/types/database";

import { AnimalRowActions } from "./row-actions";

export const metadata = { title: "Zvířata — Zozio Admin" };

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
}

export default async function AnimalsAdminPage() {
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const { data } = await supabase
    .from("animals")
    .select(
      "id, name, species, breed, age_years, age_months, birth_date, primary_photo_url, adoption_status, is_urgent",
    )
    .eq("institution_id", institutionId)
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
            Zvířata
          </h2>
          <p className="mt-1 text-ink-600">{rows.length} celkem</p>
        </div>
        <ZozioButton asChild variant="meadow" size="md">
          <Link href="/admin/animals/new">
            <Plus /> Přidat zvíře
          </Link>
        </ZozioButton>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-3xl bg-cream p-12 text-center ring-1 ring-ink-900/8">
          <div className="text-4xl">🐾</div>
          <h3 className="mt-4 font-display text-xl font-semibold text-ink-900">
            Zatím žádná zvířata
          </h3>
          <p className="mt-2 text-ink-600">
            Přidej první zvíře a začni mu hledat domov.
          </p>
          <ZozioButton asChild variant="meadow" size="md" className="mt-6">
            <Link href="/admin/animals/new">Přidat první zvíře</Link>
          </ZozioButton>
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
