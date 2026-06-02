import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleSlash,
  ExternalLink,
  Pencil,
} from "lucide-react";

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
import {
  blockerMessage,
  blockers,
  evaluateReadiness,
} from "@/lib/animal-readiness";
import {
  evaluateGates,
  getNextStep,
  isClosedStatus,
  type GateView,
} from "@/lib/animal-tabs-layout";
import { cn } from "@/lib/utils";
import type { AnimalRow } from "@/types/database";

import { StateSwitcher } from "./state-switcher";

export const metadata = { title: "Přehled zvířete — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

const COMPAT_LABEL: Record<string, string> = {
  yes: "Ano",
  no: "Ne",
  unknown: "Neznámé",
};

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

  const inProtection = a.legal_status === "in_protection";
  const closed = isClosedStatus(a.adoption_status);
  const items = evaluateReadiness(a);
  const gates = evaluateGates(items, inProtection);
  const nextStep = getNextStep({
    adoptionStatus: a.adoption_status,
    legalStatus: a.legal_status,
    readiness: items,
    name: a.name,
  });
  const publishBlockerText = blockerMessage(blockers(items, "publish"));

  const nextHref =
    nextStep.targetTab === ""
      ? `/admin/animals/${id}`
      : `/admin/animals/${id}/${nextStep.targetTab}`;

  const quickActions = buildQuickActions(id, a.adoption_status, inProtection, closed);

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

  const idParts: string[] = [];
  if (a.chip_number) idParts.push(`čip ${a.chip_number}`);
  if (a.tattoo) idParts.push(`tetování ${a.tattoo}`);
  if (a.ear_tag) idParts.push(`známka ${a.ear_tag}`);
  const identification = a.identification_none
    ? "Bez identifikace (neevidováno)"
    : idParts.length > 0
      ? idParts.join(" · ")
      : null;

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

      {/* Co teď */}
      {!closed && (
        <Link
          href={nextHref}
          className="flex items-center gap-3 rounded-xl bg-meadow-500/10 p-5 ring-1 ring-inset ring-meadow-500/20 transition-colors hover:bg-meadow-500/15"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-meadow-500 text-cream">
            <ArrowRight className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-meadow-700">
              Co teď
            </p>
            <p className="font-display text-lg font-bold text-ink-900">
              {nextStep.label}
            </p>
          </div>
        </Link>
      )}

      {!closed && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Připravenost */}
          <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
            <h2 className="mb-1 font-display text-xl font-bold text-ink-900">
              Připravenost
            </h2>
            <p className="mb-4 text-sm text-ink-500">
              Stav tří hradel a kontrolních bodů
            </p>

            <div className="mb-5 space-y-2">
              <GateChip label="Zveřejnění na web" gate={gates.publish} />
              <GateChip label="Zahájení adopce" gate={gates.adopt_start} />
              <GateChip label="Trvalá adopce" gate={gates.adopt_finalize} />
            </div>

            <ul className="space-y-1">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-start gap-3 border-b border-ink-900/5 py-2.5 last:border-none"
                >
                  <span className="mt-0.5 shrink-0">
                    {item.ok ? (
                      <Check className="size-5 text-sage-600" />
                    ) : item.severity === "hard" ? (
                      <CircleSlash className="size-5 text-meadow-500" />
                    ) : (
                      <AlertTriangle className="size-5 text-sunshine-500" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        item.ok ? "text-ink-500" : "text-ink-900",
                      )}
                    >
                      {item.label}
                      <span
                        className={cn(
                          "ml-2 align-middle rounded-pill px-1.5 py-0.5 text-[10px] font-bold",
                          item.severity === "hard"
                            ? "bg-meadow-500/10 text-meadow-700"
                            : "bg-sunshine-200 text-ink-600",
                        )}
                      >
                        {item.severity === "hard" ? "tvrdý" : "měkký"}
                      </span>
                    </p>
                    {!item.ok && (
                      <p className="mt-0.5 text-xs text-ink-500">{item.hint}</p>
                    )}
                  </div>
                  {!item.ok && item.resolve && (
                    <Link
                      href={`/admin/animals/${id}/${item.resolve}`}
                      className="inline-flex shrink-0 items-center gap-1 self-center rounded-pill bg-cream-warm px-3 py-1.5 text-xs font-semibold text-ink-700 ring-1 ring-ink-900/10 hover:bg-ink-900/8"
                    >
                      Vyřešit <ArrowRight className="size-3.5" />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {/* Pravý sloupec: změna stavu + rychlé akce */}
          <div className="space-y-6">
            <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
              <h2 className="mb-1 font-display text-xl font-bold text-ink-900">
                Změnit stav
              </h2>
              <p className="mb-4 text-sm text-ink-500">
                Ruční stavy přepínáš zde, odvozené řídí záložky
              </p>
              <StateSwitcher
                animalId={id}
                current={a.adoption_status}
                inProtection={inProtection}
                canOverride={canOverride}
                publishBlockerText={publishBlockerText}
              />
            </section>

            {quickActions.length > 0 && (
              <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
                <h2 className="mb-4 font-display text-xl font-bold text-ink-900">
                  Rychlé akce
                </h2>
                <div className="flex flex-col gap-2.5">
                  {quickActions.map((qa) => (
                    <Link
                      key={qa.href + qa.label}
                      href={qa.href}
                      className="flex items-center gap-3 rounded-lg border border-ink-900/8 bg-cream-warm px-4 py-3 text-sm font-semibold text-ink-900 transition-colors hover:border-meadow-500/40 hover:bg-cream"
                    >
                      <span className="text-lg">{qa.icon}</span>
                      {qa.label}
                      {qa.tag && (
                        <span className="ml-auto rounded-pill bg-sage-100 px-2.5 py-0.5 text-xs font-semibold text-sage-700">
                          {qa.tag}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}

      <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
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

      <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
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
        <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
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
        <section className="rounded-xl bg-cream p-6 ring-1 ring-ink-900/8">
          <h2 className="mb-3 font-display text-xl font-bold text-ink-900">
            Popis
          </h2>
          <p className="whitespace-pre-line text-ink-700">{a.description}</p>
        </section>
      )}
    </div>
  );
}

function GateChip({ label, gate }: { label: string; gate: GateView }) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-md px-3.5 py-2.5",
        gate.ok
          ? "bg-sage-50 ring-1 ring-inset ring-sage-200"
          : "bg-meadow-500/8 ring-1 ring-inset ring-meadow-500/20",
      )}
    >
      <span className="text-base">{gate.ok ? "✅" : "🔒"}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink-900">{label}</p>
        {!gate.ok && gate.reasons.length > 0 && (
          <p className="text-xs font-medium text-meadow-700">
            Blokuje: {gate.reasons.join(" + ")}
          </p>
        )}
      </div>
      <span
        className={cn(
          "rounded-pill px-2.5 py-0.5 text-xs font-bold",
          gate.ok ? "bg-sage-500 text-cream" : "bg-meadow-500 text-cream",
        )}
      >
        {gate.ok ? "OK" : "Nelze"}
      </span>
    </div>
  );
}

interface QuickAction {
  href: string;
  label: string;
  icon: string;
  tag?: string;
}

function buildQuickActions(
  id: string,
  status: AnimalRow["adoption_status"],
  inProtection: boolean,
  closed: boolean,
): QuickAction[] {
  if (closed) return [];
  const base = `/admin/animals/${id}`;
  const A = {
    foster: { href: `${base}/pestoun`, label: "Zahájit pěstounskou péči", icon: "🏡" },
    vaccine: { href: `${base}/zdravi`, label: "Přidat očkování", icon: "💉" },
    supervision: { href: `${base}/karantena`, label: "Spustit zdravotní dohled", icon: "🩺" },
    intake: { href: `${base}/prijem`, label: "Doplnit příjem & právo", icon: "📥" },
    adoption: { href: `${base}/adopce`, label: "Spravovat adopci", icon: "🤝" },
  };

  if (inProtection) {
    return [{ ...A.foster, tag: "povoleno" }, A.vaccine, A.supervision];
  }
  if (status === "available" || status === "reserved") {
    return [A.adoption, A.vaccine, A.supervision];
  }
  if (status === "foster") {
    return [A.foster, A.vaccine];
  }
  // intake / on_hold / unpublished
  return [A.intake, A.vaccine, A.supervision];
}
