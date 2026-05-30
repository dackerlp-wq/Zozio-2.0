"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";

import {
  ANIMAL_INTAKE_TYPE_LABEL,
  ANIMAL_LEGAL_STATUS_HELP,
  ANIMAL_LEGAL_STATUS_LABEL,
  ANIMAL_LEGAL_STATUS_PILL,
  VET_CARE_NEED_LABEL,
} from "@/lib/format";
import { intakeDefaults } from "@/lib/animal-intake";
import { cn } from "@/lib/utils";
import type {
  AnimalIntakeType,
  AnimalLegalStatus,
  AnimalVetCareNeed,
} from "@/types/database";

import {
  saveIntake,
  suggestRecordNumber,
  type IntakeFormValues,
} from "./intake-actions";

const inputCls =
  "w-full rounded-xl bg-cream-warm px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300";

const INTAKE_TYPES: AnimalIntakeType[] = [
  "found",
  "surrender",
  "transfer",
  "confiscation",
  "born",
  "other",
];

const LEGAL_STATUSES: AnimalLegalStatus[] = [
  "in_protection",
  "shelter_owned",
  "owner_claimed",
  "transferred_out",
];

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
      <h2 className="mb-4 font-display text-xl font-bold text-ink-900">
        <span className="mr-2">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function IntakeForm({
  animalId,
  initial,
}: {
  animalId: string;
  initial: IntakeFormValues;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [numberPending, startNumber] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [v, setV] = useState<IntakeFormValues>(initial);

  function set<K extends keyof IntakeFormValues>(
    key: K,
    value: IntakeFormValues[K],
  ) {
    setV((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  // Změna způsobu příjmu navrhne odpovídající právní stav (lze přepsat).
  function pickIntakeType(type: AnimalIntakeType | null) {
    const d = intakeDefaults(type);
    setV((prev) => ({
      ...prev,
      intake_type: type,
      legal_status: type ? d.legal_status : prev.legal_status,
      protection_until: d.protection ? prev.protection_until : "",
    }));
    setSaved(false);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await saveIntake(animalId, v);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      setSaved(true);
      router.refresh();
    });
  }

  function genNumber() {
    startNumber(async () => {
      const res = await suggestRecordNumber();
      if ("ok" in res) set("record_number", res.value);
    });
  }

  const isFound =
    v.intake_type === "found" || v.intake_type === "confiscation";
  const isSurrender = v.intake_type === "surrender";

  return (
    <form onSubmit={submit} className="space-y-6">
      {/* Právní stav — nahoře, je nejdůležitější */}
      <Section title="Právní stav" icon="⚖️">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Stav vlastnictví">
            <select
              value={v.legal_status}
              onChange={(e) =>
                set("legal_status", e.target.value as AnimalLegalStatus)
              }
              className={inputCls}
            >
              {LEGAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {ANIMAL_LEGAL_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field
            label="Konec ochranné lhůty"
            hint="Necháš-li prázdné a je vyplněno datum vyhlášení/nálezu, dopočítá se z nastavení útulku."
          >
            <input
              type="date"
              value={v.protection_until}
              onChange={(e) => set("protection_until", e.target.value)}
              className={inputCls}
              disabled={v.legal_status !== "in_protection"}
            />
          </Field>
        </div>
        <div
          className={cn(
            "mt-3 flex items-start gap-2 rounded-2xl px-4 py-3 text-sm",
            ANIMAL_LEGAL_STATUS_PILL[v.legal_status],
          )}
        >
          <span>{ANIMAL_LEGAL_STATUS_HELP[v.legal_status]}</span>
        </div>

        {(v.legal_status === "owner_claimed" || isSurrender) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Field label="Původní majitel">
              <input
                value={v.original_owner}
                onChange={(e) => set("original_owner", e.target.value)}
                placeholder="Jméno a kontakt"
                className={inputCls}
              />
            </Field>
            {isSurrender && (
              <Field label="Datum vzdání se práv">
                <input
                  type="date"
                  value={v.surrender_waiver_at}
                  onChange={(e) => set("surrender_waiver_at", e.target.value)}
                  className={inputCls}
                />
              </Field>
            )}
            {isSurrender && (
              <Field label="Sken dokladu o vzdání práv (URL)">
                <input
                  value={v.surrender_waiver_url}
                  onChange={(e) => set("surrender_waiver_url", e.target.value)}
                  placeholder="https://…"
                  className={inputCls}
                />
              </Field>
            )}
          </div>
        )}
      </Section>

      {/* Příjem */}
      <Section title="Příjem" icon="📥">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Způsob příjmu">
            <select
              value={v.intake_type ?? ""}
              onChange={(e) =>
                pickIntakeType(
                  (e.target.value || null) as AnimalIntakeType | null,
                )
              }
              className={inputCls}
            >
              <option value="">— nevybráno —</option>
              {INTAKE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ANIMAL_INTAKE_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Datum příjmu">
            <input
              type="date"
              value={v.intake_date}
              onChange={(e) => set("intake_date", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Čas příjmu">
            <input
              type="time"
              value={v.intake_time}
              onChange={(e) => set("intake_time", e.target.value)}
              className={inputCls}
            />
          </Field>

          {isFound && (
            <>
              <Field label="Místo nálezu">
                <input
                  value={v.found_location}
                  onChange={(e) => set("found_location", e.target.value)}
                  placeholder="Adresa / lokalita"
                  className={inputCls}
                />
              </Field>
              <Field label="Datum nálezu">
                <input
                  type="date"
                  value={v.found_date}
                  onChange={(e) => set("found_date", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field
                label="Datum vyhlášení nálezu"
                hint="Od tohoto data běží ochranná lhůta."
              >
                <input
                  type="date"
                  value={v.announced_at}
                  onChange={(e) => set("announced_at", e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="GPS šířka (lat)">
                <input
                  type="number"
                  step="0.000001"
                  value={v.found_lat ?? ""}
                  onChange={(e) =>
                    set("found_lat", e.target.value ? Number(e.target.value) : null)
                  }
                  placeholder="50.0755"
                  className={inputCls}
                />
              </Field>
              <Field label="GPS délka (lng)">
                <input
                  type="number"
                  step="0.000001"
                  value={v.found_lng ?? ""}
                  onChange={(e) =>
                    set("found_lng", e.target.value ? Number(e.target.value) : null)
                  }
                  placeholder="14.4378"
                  className={inputCls}
                />
              </Field>
            </>
          )}

          <Field label="Kdo zvíře předal / přinesl">
            <input
              value={v.handed_over_by}
              onChange={(e) => set("handed_over_by", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Telefon předávajícího">
            <input
              type="tel"
              value={v.handed_over_phone}
              onChange={(e) => set("handed_over_phone", e.target.value)}
              placeholder="+420…"
              className={inputCls}
            />
          </Field>
          <Field label="E-mail předávajícího">
            <input
              type="email"
              value={v.handed_over_email}
              onChange={(e) => set("handed_over_email", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
        {v.intake_type && (
          <div className="mt-3 flex items-start gap-2 rounded-2xl bg-sage-50 px-4 py-3 text-sm text-ink-700 ring-1 ring-inset ring-ink-900/8">
            <Sparkles className="mt-0.5 size-4 shrink-0 text-meadow-600" />
            <span>{intakeDefaults(v.intake_type).note}</span>
          </div>
        )}
        <div className="mt-3">
          <Field label="Stav při příjmu">
            <textarea
              rows={2}
              value={v.intake_condition}
              onChange={(e) => set("intake_condition", e.target.value)}
              placeholder="Zdravotní a celkový stav zvířete při převzetí…"
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      {/* Identifikace */}
      <Section title="Identifikace" icon="🏷️">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Interní evidenční číslo">
            <div className="flex gap-2">
              <input
                value={v.record_number}
                onChange={(e) => set("record_number", e.target.value)}
                placeholder="2026/0001"
                className={inputCls}
              />
              <button
                type="button"
                onClick={genNumber}
                disabled={numberPending}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-ink-900 px-3 text-sm font-semibold text-cream hover:bg-ink-800 disabled:opacity-50"
              >
                <Sparkles className="size-4" />
                {numberPending ? "…" : "Navrhnout"}
              </button>
            </div>
          </Field>
          <Field label="Číslo čipu" hint="Vyplněný čip = automaticky potvrzeno čipováno.">
            <input
              value={v.chip_number}
              onChange={(e) => set("chip_number", e.target.value)}
              disabled={v.identification_none}
              className={inputCls}
            />
          </Field>
          <Field label="Tetování">
            <input
              value={v.tattoo}
              onChange={(e) => set("tattoo", e.target.value)}
              disabled={v.identification_none}
              className={inputCls}
            />
          </Field>
          <Field label="Známka">
            <input
              value={v.ear_tag}
              onChange={(e) => set("ear_tag", e.target.value)}
              disabled={v.identification_none}
              className={inputCls}
            />
          </Field>
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-2xl bg-cream-warm px-4 py-3 ring-1 ring-ink-900/8">
          <input
            type="checkbox"
            checked={v.identification_none}
            onChange={(e) =>
              setV((prev) => ({
                ...prev,
                identification_none: e.target.checked,
                chip_number: e.target.checked ? "" : prev.chip_number,
                tattoo: e.target.checked ? "" : prev.tattoo,
                ear_tag: e.target.checked ? "" : prev.ear_tag,
              }))
            }
            className="size-5 rounded accent-meadow-500"
          />
          <span className="text-sm font-semibold text-ink-700">
            Bez identifikace (neevidováno)
          </span>
        </label>
      </Section>

      {/* Veterinární péče & dohled při příjmu */}
      <Section title="Veterinární péče & dohled" icon="🚑">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Potřeba veterinární péče">
            <select
              value={v.vet_care_need ?? ""}
              onChange={(e) =>
                set(
                  "vet_care_need",
                  (e.target.value || null) as AnimalVetCareNeed | null,
                )
              }
              className={inputCls}
            >
              <option value="">— nevybráno —</option>
              <option value="none">{VET_CARE_NEED_LABEL.none}</option>
              <option value="required">{VET_CARE_NEED_LABEL.required}</option>
              <option value="scheduled">{VET_CARE_NEED_LABEL.scheduled}</option>
              <option value="deferred">{VET_CARE_NEED_LABEL.deferred}</option>
            </select>
          </Field>
          <Field
            label="Plánované trvání karantény (dní)"
            hint="Orientační údaj z příjmu. Reálný průběh řeš na záložce Karanténa."
          >
            <input
              type="number"
              min={0}
              max={365}
              value={v.intake_quarantine_days ?? ""}
              onChange={(e) =>
                set(
                  "intake_quarantine_days",
                  e.target.value ? Number(e.target.value) : null,
                )
              }
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      {/* Personál & evidence */}
      <Section title="Personál & evidence" icon="📝">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Přijal (jméno / role)">
            <input
              value={v.intake_staff}
              onChange={(e) => set("intake_staff", e.target.value)}
              placeholder="Jana Nováková, ošetřovatelka"
              className={inputCls}
            />
          </Field>
          <Field label="Evidenční číslo obce (volitelné)">
            <input
              value={v.municipality_ref}
              onChange={(e) => set("municipality_ref", e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Registr nalezenců (volitelné)">
            <input
              value={v.registry_name}
              onChange={(e) => set("registry_name", e.target.value)}
              placeholder="Název registru, pokud nahlášeno"
              className={inputCls}
            />
          </Field>
          <Field label="Poznámky k příjmu">
            <textarea
              rows={2}
              value={v.intake_notes}
              onChange={(e) => set("intake_notes", e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
      </Section>

      <div className="flex items-center justify-end gap-3">
        {error && <span className="mr-auto text-sm text-berry">{error}</span>}
        {saved && !error && (
          <span className="mr-auto text-sm font-semibold text-sage-700">
            Uloženo ✓
          </span>
        )}
        <button
          type="submit"
          disabled={pending}
          className="rounded-pill bg-meadow-500 px-6 py-2.5 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
        >
          {pending ? "Ukládám…" : "Uložit"}
        </button>
      </div>
    </form>
  );
}
