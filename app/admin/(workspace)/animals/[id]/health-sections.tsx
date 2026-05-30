"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";

import { TREATMENT_TYPE_LABEL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  TreatmentRow,
  TreatmentType,
  VaccinationRow,
  VetRecordRow,
  WeightLogRow,
} from "@/types/database";

import {
  addTreatment,
  addVaccination,
  addVetRecord,
  addWeightLog,
  deleteHealthEntry,
} from "../health-actions";

type ActionResult = { error: string } | { ok: true };
type DeletableTable = "weight_logs" | "vaccinations" | "treatments" | "vet_records";

const inputCls =
  "w-full rounded-xl bg-cream-warm px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-400";

const today = () => new Date().toISOString().slice(0, 10);

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
        {label}
      </span>
      {children}
    </label>
  );
}

function SectionShell({
  title,
  icon,
  count,
  children,
  form,
}: {
  title: string;
  icon: string;
  count: number;
  children: ReactNode;
  form: (close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-ink-900">
          <span className="mr-2">{icon}</span>
          {title}
          {count > 0 && (
            <span className="ml-2 text-sm font-semibold text-ink-400">
              {count}
            </span>
          )}
        </h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-pill bg-ink-900 px-3 py-1.5 text-sm font-semibold text-cream hover:bg-ink-800"
        >
          {open ? <X className="size-4" /> : <Plus className="size-4" />}
          {open ? "Zavřít" : "Přidat"}
        </button>
      </div>
      {open && (
        <div className="mb-5 rounded-2xl bg-cream-warm/60 p-4 ring-1 ring-ink-900/8">
          {form(() => setOpen(false))}
        </div>
      )}
      {children}
    </section>
  );
}

function SubmitRow({
  pending,
  error,
  onCancel,
}: {
  pending: boolean;
  error: string | null;
  onCancel: () => void;
}) {
  return (
    <div className="mt-3 flex items-center justify-end gap-2">
      {error && <span className="mr-auto text-xs text-berry">{error}</span>}
      <button
        type="button"
        onClick={onCancel}
        className="rounded-pill px-3 py-1.5 text-sm font-semibold text-ink-600 hover:bg-cream"
      >
        Zrušit
      </button>
      <button
        type="submit"
        disabled={pending}
        className="rounded-pill bg-meadow-500 px-4 py-1.5 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
      >
        {pending ? "Ukládám…" : "Uložit"}
      </button>
    </div>
  );
}

function DeleteButton({
  table,
  entryId,
  animalId,
}: {
  table: DeletableTable;
  entryId: string;
  animalId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await deleteHealthEntry(table, entryId, animalId);
              router.refresh();
            })
          }
          className="rounded-full bg-berry px-2.5 py-1 text-xs font-semibold text-cream disabled:opacity-50"
        >
          {pending ? "Mažu…" : "Smazat"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="rounded-full bg-cream-warm px-2.5 py-1 text-xs font-semibold text-ink-600"
        >
          Zpět
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      aria-label="Smazat záznam"
      className="rounded-full p-1.5 text-ink-400 hover:bg-cream-warm hover:text-berry"
    >
      <Trash2 className="size-4" />
    </button>
  );
}

function useSubmit(animalId: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<ActionResult>, onDone: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if ("error" in res) {
        setError(res.error);
        return;
      }
      onDone();
      router.refresh();
    });
  }

  return { pending, error, run, setError };
}

function EmptyHint({ text }: { text: string }) {
  return <p className="text-sm text-ink-500">{text}</p>;
}

// ---- Váha -----------------------------------------------------------------

export function WeightSection({
  animalId,
  rows,
}: {
  animalId: string;
  rows: WeightLogRow[];
}) {
  return (
    <SectionShell
      title="Váha"
      icon="⚖️"
      count={rows.length}
      form={(close) => <WeightForm animalId={animalId} close={close} />}
    >
      {rows.length === 0 ? (
        <EmptyHint text="Zatím žádné záznamy o váze." />
      ) : (
        <ul className="divide-y divide-ink-900/8">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 py-2.5">
              <span className="font-display text-lg font-bold text-ink-900">
                {r.weight_kg} kg
              </span>
              <span className="text-sm text-ink-500">
                {formatDate(r.measured_at)}
              </span>
              {r.note && (
                <span className="truncate text-sm text-ink-600">· {r.note}</span>
              )}
              <span className="ml-auto">
                <DeleteButton
                  table="weight_logs"
                  entryId={r.id}
                  animalId={animalId}
                />
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

function WeightForm({ animalId, close }: { animalId: string; close: () => void }) {
  const { pending, error, run } = useSubmit(animalId);
  const [weight, setWeight] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            addWeightLog(animalId, {
              weight_kg: Number(weight),
              measured_at: date,
              note,
            }),
          close,
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Váha (kg)">
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Datum">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Poznámka">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <SubmitRow pending={pending} error={error} onCancel={close} />
    </form>
  );
}

// ---- Očkování -------------------------------------------------------------

export function VaccinationSection({
  animalId,
  rows,
}: {
  animalId: string;
  rows: VaccinationRow[];
}) {
  return (
    <SectionShell
      title="Očkování"
      icon="💉"
      count={rows.length}
      form={(close) => <VaccinationForm animalId={animalId} close={close} />}
    >
      {rows.length === 0 ? (
        <EmptyHint text="Zatím žádná očkování." />
      ) : (
        <ul className="divide-y divide-ink-900/8">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-ink-900">{r.vaccine}</div>
                <div className="text-sm text-ink-500">
                  Podáno {formatDate(r.administered_at)}
                  {r.valid_until && <> · platí do {formatDate(r.valid_until)}</>}
                  {r.vet_name && <> · {r.vet_name}</>}
                </div>
                {r.notes && (
                  <p className="mt-0.5 text-sm text-ink-600">{r.notes}</p>
                )}
              </div>
              <DeleteButton
                table="vaccinations"
                entryId={r.id}
                animalId={animalId}
              />
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

function VaccinationForm({
  animalId,
  close,
}: {
  animalId: string;
  close: () => void;
}) {
  const { pending, error, run } = useSubmit(animalId);
  const [vaccine, setVaccine] = useState("");
  const [administered, setAdministered] = useState(today());
  const [validUntil, setValidUntil] = useState("");
  const [vet, setVet] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            addVaccination(animalId, {
              vaccine,
              administered_at: administered,
              valid_until: validUntil,
              vet_name: vet,
              notes,
            }),
          close,
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Vakcína">
          <input
            required
            value={vaccine}
            onChange={(e) => setVaccine(e.target.value)}
            placeholder="např. Vzteklina"
            className={inputCls}
          />
        </Field>
        <Field label="Veterinář">
          <input
            value={vet}
            onChange={(e) => setVet(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Podáno">
          <input
            type="date"
            value={administered}
            onChange={(e) => setAdministered(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Platí do">
          <input
            type="date"
            value={validUntil}
            onChange={(e) => setValidUntil(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Poznámka">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <SubmitRow pending={pending} error={error} onCancel={close} />
    </form>
  );
}

// ---- Léčba ----------------------------------------------------------------

const TREATMENT_TYPES: TreatmentType[] = [
  "medication",
  "deworming",
  "antiparasitic",
  "other",
];

export function TreatmentSection({
  animalId,
  rows,
}: {
  animalId: string;
  rows: TreatmentRow[];
}) {
  const todayStr = today();
  return (
    <SectionShell
      title="Léčba"
      icon="💊"
      count={rows.length}
      form={(close) => <TreatmentForm animalId={animalId} close={close} />}
    >
      {rows.length === 0 ? (
        <EmptyHint text="Zatím žádná léčba." />
      ) : (
        <ul className="divide-y divide-ink-900/8">
          {rows.map((r) => {
            const overdue = r.next_due != null && r.next_due <= todayStr;
            return (
              <li key={r.id} className="flex items-start gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink-900">{r.name}</span>
                    <span className="rounded-full bg-sage-100 px-2 py-0.5 text-xs font-semibold text-sage-700">
                      {TREATMENT_TYPE_LABEL[r.type]}
                    </span>
                    {r.next_due && (
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-semibold",
                          overdue
                            ? "bg-peach-200 text-terracotta-600"
                            : "bg-sunshine-200 text-sunshine-600",
                        )}
                      >
                        Další: {formatDate(r.next_due)}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-ink-500">
                    {[r.dosage, r.frequency, r.vet_name]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                  {r.notes && (
                    <p className="mt-0.5 text-sm text-ink-600">{r.notes}</p>
                  )}
                </div>
                <DeleteButton
                  table="treatments"
                  entryId={r.id}
                  animalId={animalId}
                />
              </li>
            );
          })}
        </ul>
      )}
    </SectionShell>
  );
}

function TreatmentForm({
  animalId,
  close,
}: {
  animalId: string;
  close: () => void;
}) {
  const { pending, error, run } = useSubmit(animalId);
  const [type, setType] = useState<TreatmentType>("medication");
  const [name, setName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [nextDue, setNextDue] = useState("");
  const [vet, setVet] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            addTreatment(animalId, {
              type,
              name,
              dosage,
              frequency,
              start_date: startDate,
              end_date: endDate,
              next_due: nextDue,
              vet_name: vet,
              notes,
            }),
          close,
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Typ">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TreatmentType)}
            className={inputCls}
          >
            {TREATMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {TREATMENT_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Název">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Dávkování">
          <input
            value={dosage}
            onChange={(e) => setDosage(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Frekvence">
          <input
            value={frequency}
            onChange={(e) => setFrequency(e.target.value)}
            placeholder="např. 2× denně"
            className={inputCls}
          />
        </Field>
        <Field label="Od">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Do">
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Příští dávka (připomínka)">
          <input
            type="date"
            value={nextDue}
            onChange={(e) => setNextDue(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Veterinář">
          <input
            value={vet}
            onChange={(e) => setVet(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Poznámka">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <SubmitRow pending={pending} error={error} onCancel={close} />
    </form>
  );
}

// ---- Veterinární záznamy --------------------------------------------------

export function VetRecordSection({
  animalId,
  rows,
}: {
  animalId: string;
  rows: VetRecordRow[];
}) {
  return (
    <SectionShell
      title="Veterinární záznamy"
      icon="🩺"
      count={rows.length}
      form={(close) => <VetRecordForm animalId={animalId} close={close} />}
    >
      {rows.length === 0 ? (
        <EmptyHint text="Zatím žádné veterinární záznamy." />
      ) : (
        <ul className="divide-y divide-ink-900/8">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-ink-900">{r.title}</span>
                  <span className="rounded-full bg-ink-900/8 px-2 py-0.5 text-xs font-semibold text-ink-600">
                    {r.category}
                  </span>
                </div>
                <div className="text-sm text-ink-500">
                  {formatDate(r.recorded_at)}
                  {r.vet_name && <> · {r.vet_name}</>}
                </div>
                {r.notes && (
                  <p className="mt-0.5 whitespace-pre-line text-sm text-ink-600">
                    {r.notes}
                  </p>
                )}
              </div>
              <DeleteButton
                table="vet_records"
                entryId={r.id}
                animalId={animalId}
              />
            </li>
          ))}
        </ul>
      )}
    </SectionShell>
  );
}

function VetRecordForm({
  animalId,
  close,
}: {
  animalId: string;
  close: () => void;
}) {
  const { pending, error, run } = useSubmit(animalId);
  const [recordedAt, setRecordedAt] = useState(today());
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [vet, setVet] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            addVetRecord(animalId, {
              recorded_at: recordedAt,
              category,
              title,
              vet_name: vet,
              notes,
            }),
          close,
        );
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Název">
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="např. Kastrace"
            className={inputCls}
          />
        </Field>
        <Field label="Kategorie">
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            placeholder="např. Operace, Prohlídka"
            className={inputCls}
          />
        </Field>
        <Field label="Datum">
          <input
            type="date"
            value={recordedAt}
            onChange={(e) => setRecordedAt(e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Veterinář">
          <input
            value={vet}
            onChange={(e) => setVet(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <div className="mt-3">
        <Field label="Poznámka">
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <SubmitRow pending={pending} error={error} onCancel={close} />
    </form>
  );
}
