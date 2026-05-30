import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Home } from "lucide-react";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ADOPTION_STATUS_LABEL,
  ADOPTION_STATUS_PILL,
  ANIMAL_LEGAL_STATUS_LABEL,
  ANIMAL_LEGAL_STATUS_PILL,
  isTerminalAdoptionStatus,
  SPECIES_LABEL,
  SUPERVISION_STATUS_LABEL,
  SUPERVISION_STATUS_PILL,
} from "@/lib/format";
import { animalAgeLabel } from "@/lib/animal-age";
import { cn } from "@/lib/utils";
import type {
  AdoptionStatus,
  AnimalLegalStatus,
  AnimalSupervisionStatus,
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
  supervision_status: AnimalSupervisionStatus;
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
      "id, name, species, breed, age_years, age_months, birth_date, primary_photo_url, adoption_status, legal_status, protection_until, supervision_status, kennel_id, kennels(name)",
    )
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!data) notFound();
  const a = data as unknown as HeaderRow;

  // Existence strukturovaných záznamů — pro podmíněné zobrazení záložek.
  const [foster, quarantine, adoption, exit, trial] = await Promise.all([
    supabase
      .from("foster_placements")
      .select("id", { count: "exact", head: true })
      .eq("animal_id", id),
    supabase
      .from("quarantine_records")
      .select("id", { count: "exact", head: true })
      .eq("animal_id", id),
    supabase
      .from("adoptions")
      .select("id", { count: "exact", head: true })
      .eq("animal_id", id),
    supabase
      .from("animal_exit_records")
      .select("id", { count: "exact", head: true })
      .eq("animal_id", id),
    supabase
      .from("adoptions")
      .select("id", { count: "exact", head: true })
      .eq("animal_id", id)
      .eq("stage", "trial"),
  ]);

  const has = (r: { count: number | null }) => (r.count ?? 0) > 0;
  const term = isTerminalAdoptionStatus(a.adoption_status);
  const released = a.supervision_status === "released";
  const inProtection = a.legal_status === "in_protection";

  // Záložka se skryje, když v aktuálním stavu nedává smysl a neexistuje historie.
  const hidden: string[] = [];
  if (released && !has(quarantine)) hidden.push("karantena");
  if (term && !has(foster)) hidden.push("pestoun");
  if (term && !has(adoption) && !has(exit)) hidden.push("adopce");
  if (term && !a.kennel_id) hidden.push("ustajeni");

  // Tečka „vyžaduje pozornost".
  const attention: string[] = [];
  if (a.supervision_status === "quarantine" || a.supervision_status === "isolation")
    attention.push("karantena");
  if (inProtection) attention.push("prijem");
  if (has(trial)) attention.push("adopce");

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
            {a.supervision_status !== "released" && (
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  SUPERVISION_STATUS_PILL[a.supervision_status],
                )}
              >
                {SUPERVISION_STATUS_LABEL[a.supervision_status]}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-600">
            <span>
              {[
                SPECIES_LABEL[a.species],
                a.breed,
                animalAgeLabel(a),
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

      {(a.supervision_status === "quarantine" ||
        a.supervision_status === "isolation") && (
        <div className="flex items-start gap-3 rounded-3xl bg-peach-100 p-4 text-sm ring-1 ring-inset ring-peach-300/60">
          <span className="text-lg">🧫</span>
          <div>
            <p className="font-semibold text-ink-900">
              {a.supervision_status === "isolation"
                ? "Zvíře je v izolaci"
                : "Zvíře je v karanténě"}
            </p>
            <p className="mt-0.5 text-ink-700">
              Drž ho odděleně od ostatních zvířat. Detail a ukončení najdeš v
              záložce Karanténa.
            </p>
          </div>
        </div>
      )}

      <div className="border-b border-ink-900/10">
        <AnimalTabs animalId={a.id} hidden={hidden} attention={attention} />
      </div>

      <div>{children}</div>
    </div>
  );
}
