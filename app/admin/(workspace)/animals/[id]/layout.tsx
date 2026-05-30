import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Home } from "lucide-react";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ADOPTION_STATUS_LABEL,
  ADOPTION_STATUS_PILL,
  ageLabel,
  ANIMAL_LEGAL_STATUS_LABEL,
  ANIMAL_LEGAL_STATUS_PILL,
  SPECIES_LABEL,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  AdoptionStatus,
  AnimalLegalStatus,
  Species,
} from "@/types/database";

import { AnimalTabs } from "./animal-tabs";

interface LayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

interface HeaderRow {
  id: string;
  name: string;
  species: Species;
  breed: string | null;
  age_years: number | null;
  age_months: number | null;
  primary_photo_url: string | null;
  adoption_status: AdoptionStatus;
  legal_status: AnimalLegalStatus;
  protection_until: string | null;
  kennel_id: string | null;
  kennels: { name: string } | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

export default async function AnimalHubLayout({
  children,
  params,
}: LayoutProps) {
  const { id } = await params;
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const { data } = await supabase
    .from("animals")
    .select(
      "id, name, species, breed, age_years, age_months, primary_photo_url, adoption_status, legal_status, protection_until, kennel_id, kennels(name)",
    )
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!data) notFound();
  const a = data as unknown as HeaderRow;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link
        href="/admin/animals"
        className="inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-sage-700"
      >
        <ChevronLeft className="size-4" /> Zpět na zvířata
      </Link>

      <div className="flex flex-wrap items-center gap-4 rounded-3xl bg-cream p-5 ring-1 ring-ink-900/8">
        <div className="size-20 shrink-0 overflow-hidden rounded-2xl bg-cream-warm">
          {a.primary_photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={a.primary_photo_url}
              alt={a.name}
              className="size-full object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-4xl">
              🐾
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">
              {a.name}
            </h1>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold",
                ADOPTION_STATUS_PILL[a.adoption_status],
              )}
            >
              {ADOPTION_STATUS_LABEL[a.adoption_status]}
            </span>
            {a.legal_status !== "shelter_owned" && (
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  ANIMAL_LEGAL_STATUS_PILL[a.legal_status],
                )}
              >
                {ANIMAL_LEGAL_STATUS_LABEL[a.legal_status]}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-600">
            <span>
              {[
                SPECIES_LABEL[a.species],
                a.breed,
                ageLabel(a.age_years, a.age_months),
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
            {a.kennels?.name && (
              <span className="inline-flex items-center gap-1 text-ink-500">
                <Home className="size-3.5" /> {a.kennels.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {a.legal_status === "in_protection" && (
        <div className="flex items-start gap-3 rounded-3xl bg-sunshine-200 p-4 text-sm ring-1 ring-inset ring-sunshine-400/40">
          <span className="text-lg">⏳</span>
          <div>
            <p className="font-semibold text-ink-900">
              Zvíře je v ochranné lhůtě
            </p>
            <p className="mt-0.5 text-ink-700">
              Původní majitel se může přihlásit
              {a.protection_until ? (
                <> do {formatDate(a.protection_until)}</>
              ) : null}
              . Trvalá adopce ani převod nejsou možné, dokud lhůta neskončí.
              Dočasná péče je povolena.
            </p>
          </div>
        </div>
      )}

      <div className="border-b border-ink-900/10">
        <AnimalTabs animalId={a.id} />
      </div>

      <div>{children}</div>
    </div>
  );
}
