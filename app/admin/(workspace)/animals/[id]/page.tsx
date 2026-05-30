import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, ExternalLink } from "lucide-react";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  ANIMAL_INTAKE_TYPE_LABEL,
  ANIMAL_LEGAL_STATUS_LABEL,
  ENERGY_LABEL,
  HEALTH_STATUS_LABEL,
  SEX_LABEL,
  SIZE_LABEL,
  SUPERVISION_STATUS_LABEL,
  VET_CARE_NEED_LABEL,
} from "@/lib/format";
import type { AnimalRow } from "@/types/database";

import { ReadinessPanel } from "./readiness-panel";
import { StatusChanger } from "./status-changer";

export const metadata = { title: "Přehled zvířete — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

const COMPAT_LABEL: Record<string, string> = {
  yes: "Ano",
  no: "Ne",
  unknown: "Neznámé",
};

/** Pomocná: datum + volitelně čas. */
function dateTime(date: string | null, time: string | null): string | null {
  if (!date) return null;
  return time ? `${date} ${time.slice(0, 5)}` : date;
}

export default async function AnimalOverviewPage({ params }: PageProps) {
  const { id } = await params;
  const { institutionId, role } = await requireMembership();
  const canOverride = role === "owner" || role === "admin";
  const supabase = await createClient();

  const { data } = await supabase
    .from("animals")
    .select("*")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!data) notFound();
  const a = data as AnimalRow;

  const factsAbout = [
    { label: "Pohlaví", value: SEX_LABEL[a.sex] },
    { label: "Velikost", value: a.size ? SIZE_LABEL[a.size] : null },
    { label: "Barva", value: a.color },
    { label: "Váha", value: a.weight_kg ? `${a.weight_kg} kg` : null },
    { label: "Energie", value: a.energy_level ? ENERGY_LABEL[a.energy_level] : null },
    {
      label: "Kastrace",
      value: a.is_neutered == null ? null : a.is_neutered ? "Ano" : "Ne",
    },
    { label: "Očkování", value: a.is_vaccinated ? "Ano" : "Ne" },
    {
      label: "Čip",
      value: a.is_chipped == null ? null : a.is_chipped ? "Ano" : "Ne",
    },
  ].filter((f) => f.value != null);

  const compat = [
    { label: "S dětmi", value: COMPAT_LABEL[a.good_with_children] },
    { label: "Se psy", value: COMPAT_LABEL[a.good_with_dogs] },
    { label: "S kočkami", value: COMPAT_LABEL[a.good_with_cats] },
  ];

  // Identifikace — text z čipu/tetování/známky, nebo „neevidováno".
  const idParts: string[] = [];
  if (a.chip_number) idParts.push(`čip ${a.chip_number}`);
  if (a.tattoo) idParts.push(`tetování ${a.tattoo}`);
  if (a.ear_tag) idParts.push(`známka ${a.ear_tag}`);
  const identification = a.identification_none
    ? "Bez identifikace (neevidováno)"
    : idParts.length > 0
      ? idParts.join(" · ")
      : null;

  // Kompletní přehled příjmových informací (propsané z příjmového protokolu).
  const intakeFacts = [
    {
      label: "Způsob příjmu",
      value: a.intake_type ? ANIMAL_INTAKE_TYPE_LABEL[a.intake_type] : null,
    },
    { label: "Evidenční číslo", value: a.record_number },
    { label: "Datum a čas příjmu", value: dateTime(a.intake_date, a.intake_time) },
    { label: "Místo nálezu", value: a.found_location },
    {
      label: "GPS",
      value:
        a.found_lat != null && a.found_lng != null
          ? `${a.found_lat}, ${a.found_lng}`
          : null,
    },
    { label: "Datum nálezu", value: a.found_date },
    { label: "Datum vyhlášení", value: a.announced_at },
    { label: "Identifikace", value: identification },
    {
      label: "Veterinární péče",
      value: a.vet_care_need ? VET_CARE_NEED_LABEL[a.vet_care_need] : null,
    },
    {
      label: "Režim dohledu",
      value: SUPERVISION_STATUS_LABEL[a.supervision_status] ?? null,
    },
    {
      label: "Plánovaná karanténa",
      value:
        a.intake_quarantine_days != null
          ? `${a.intake_quarantine_days} dní`
          : null,
    },
    {
      label: "Právní stav",
      value: ANIMAL_LEGAL_STATUS_LABEL[a.legal_status] ?? null,
    },
    { label: "Konec ochranné lhůty", value: a.protection_until },
    { label: "Předal / přinesl", value: a.handed_over_by },
    { label: "Telefon předávajícího", value: a.handed_over_phone },
    { label: "E-mail předávajícího", value: a.handed_over_email },
    { label: "Původní majitel", value: a.original_owner },
    { label: "Přijal (personál)", value: a.intake_staff },
    { label: "Evidenční číslo obce", value: a.municipality_ref },
    { label: "Registr nalezenců", value: a.registry_name },
  ].filter((f) => f.value != null && f.value !== "");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <StatusChanger
          animalId={id}
          current={a.adoption_status}
          legalStatus={a.legal_status}
          supervisionStatus={a.supervision_status}
          canOverride={canOverride}
        />
        <Link
          href={`/admin/animals/${id}/profil`}
          className="inline-flex items-center gap-1.5 rounded-pill bg-ink-900 px-4 py-2 text-sm font-semibold text-cream hover:bg-ink-800"
        >
          <Pencil className="size-4" /> Upravit profil
        </Link>
        <Link
          href={`/animals/${id}`}
          target="_blank"
          className="inline-flex items-center gap-1.5 rounded-pill bg-cream px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-ink-900/10 hover:bg-cream-warm"
        >
          Veřejný profil <ExternalLink className="size-4" />
        </Link>
      </div>

      <ReadinessPanel animalId={id} animal={a} />

      <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
        <h2 className="mb-4 font-display text-xl font-bold text-ink-900">
          Základní údaje
        </h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          {factsAbout.map((f) => (
            <div key={f.label}>
              <dt className="text-xs uppercase tracking-wide text-ink-400">
                {f.label}
              </dt>
              <dd className="mt-0.5 text-ink-900">{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
        <h2 className="mb-4 font-display text-xl font-bold text-ink-900">
          Zdraví & povaha
        </h2>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-xs uppercase tracking-wide text-ink-400">
              Zdravotní stav
            </dt>
            <dd className="mt-0.5 text-ink-900">
              {HEALTH_STATUS_LABEL[a.health_status] ?? a.health_status}
            </dd>
          </div>
          {compat.map((c) => (
            <div key={c.label}>
              <dt className="text-xs uppercase tracking-wide text-ink-400">
                {c.label}
              </dt>
              <dd className="mt-0.5 text-ink-900">{c.value}</dd>
            </div>
          ))}
        </dl>
        {a.personality_tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {a.personality_tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-sage-100 px-3 py-1 text-xs font-semibold text-sage-700"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
        {a.health_notes && (
          <p className="mt-4 whitespace-pre-line text-sm text-ink-700">
            {a.health_notes}
          </p>
        )}
      </section>

      {intakeFacts.length > 0 && (
        <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="font-display text-xl font-bold text-ink-900">
              Příjem & evidence
            </h2>
            <Link
              href={`/admin/animals/${id}/prijem`}
              className="inline-flex items-center gap-1.5 rounded-pill bg-cream-warm px-3 py-1.5 text-xs font-semibold text-ink-700 ring-1 ring-ink-900/10 hover:bg-cream"
            >
              <Pencil className="size-3.5" /> Upravit příjem
            </Link>
          </div>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {intakeFacts.map((f) => (
              <div key={f.label}>
                <dt className="text-xs uppercase tracking-wide text-ink-400">
                  {f.label}
                </dt>
                <dd className="mt-0.5 text-ink-900">{f.value}</dd>
              </div>
            ))}
          </dl>
          {a.intake_condition && (
            <div className="mt-4">
              <dt className="text-xs uppercase tracking-wide text-ink-400">
                Stav při příjmu
              </dt>
              <dd className="mt-0.5 whitespace-pre-line text-sm text-ink-700">
                {a.intake_condition}
              </dd>
            </div>
          )}
          {a.intake_notes && (
            <div className="mt-4">
              <dt className="text-xs uppercase tracking-wide text-ink-400">
                Poznámky k příjmu
              </dt>
              <dd className="mt-0.5 whitespace-pre-line text-sm text-ink-700">
                {a.intake_notes}
              </dd>
            </div>
          )}
        </section>
      )}

      {a.description && (
        <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
          <h2 className="mb-3 font-display text-xl font-bold text-ink-900">
            Popis
          </h2>
          <p className="whitespace-pre-line text-ink-700">{a.description}</p>
        </section>
      )}
    </div>
  );
}
