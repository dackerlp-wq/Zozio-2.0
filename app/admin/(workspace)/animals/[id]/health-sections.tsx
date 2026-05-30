"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Paperclip, Plus, Trash2, X } from "lucide-react";

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
  type TreatmentSchedule,
} from "../health-actions";

type ActionResult = { error: string } | { ok: true };
type DeletableTable = "weight_logs" | "vaccinations" | "treatments" | "vet_records";

/** Předvolby automatického opakování léku → frekvence + interval. */
const TREATMENT_RECURRENCE: Record<
  string,
  { label: string; schedule: TreatmentSchedule | null }
> = {
  none: { label: "Nevytvářet úkoly", schedule: null },
  daily: { label: "Denně", schedule: { freq: "daily", interval: 1 } },
  every2: { label: "Každý 2. den", schedule: { freq: "daily", interval: 2 } },
  every3: { label: "Každý 3. den", schedule: { freq: "daily", interval: 3 } },
  weekly: { label: "Týdně", schedule: { freq: "weekly", interval: 1 } },
};
const RECURRENCE_KEYS = Object.keys(TREATMENT_RECURRENCE);

const inputCls =
  "w-full rounded-xl bg-cream-warm px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300";

const today = () => new Date().toISOString().slice(0, 10);

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

/** Počet dní od dneška do data (záporné = v minulosti). */
function daysUntil(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  const now = new Date(today() + "T00:00:00");
  return Math.round((d.getTime() - now.getTime()) / 86_400_000);
}

// ---- Sdílené tabulkové primitivy -----------------------------------------
// Záznamy se na desktopu zobrazují jako zarovnaná tabulka (mřížka se záhlavím
// sloupců), na mobilu se zalomí do kompaktní kartičky s popisky.

function TableHead({ cols, grid }: { cols: string[]; grid: string }) {
  return (
    <div
      className={cn(
        "hidden gap-x-4 border-b border-ink-900/8 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400 sm:grid",
        grid,
      )}
    >
      {cols.map((c, i) => (
        <div key={i}>{c}</div>
      ))}
    </div>
  );
}

function Row({
  grid,
  muted = false,
  children,
}: {
  grid: string;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative grid grid-cols-1 gap-x-4 gap-y-1 rounded-xl px-3 py-2.5 pr-12 text-sm hover:bg-cream-warm/40 sm:items-center sm:pr-3",
        grid,
        muted && "opacity-60",
      )}
    >
      {children}
    </div>
  );
}

function Cell({
  label,
  className,
  children,
}: {
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      {label && (
        <span className="mr-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400 sm:hidden">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}

/** Buňka s akcí (smazat) — na mobilu vpravo nahoře, na desktopu poslední sloupec. */
function ActionCell({ children }: { children: ReactNode }) {
  return (
    <div className="absolute right-2 top-2 sm:static sm:justify-self-end">
      {children}
    </div>
  );
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

// ---- Přílohy (dokumenty) --------------------------------------------------

/** Odkaz na dokument propojený se záznamem (mapováno podle related_id). */
export interface RecordDoc {
  id: string;
  title: string;
  url: string | null;
}

type AttachedDoc = {
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
};

async function uploadDoc(file: File): Promise<AttachedDoc> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", "document");
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Nahrání selhalo.");
  return {
    file_path: data.path as string,
    file_name: file.name,
    file_size: file.size,
    mime_type: file.type,
  };
}

/** Volitelné přiložení souboru ve formuláři zdravotního záznamu. */
function DocAttachField({
  file,
  onChange,
}: {
  file: File | null;
  onChange: (f: File | null) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="mt-3">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-400">
        Dokument (volitelné)
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={ref}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*"
          className="hidden"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
        <button
          type="button"
          onClick={() => ref.current?.click()}
          className="inline-flex items-center gap-2 rounded-xl bg-cream px-3 py-2 text-sm font-semibold text-ink-700 ring-1 ring-ink-900/10 hover:bg-cream-warm"
        >
          <Paperclip className="size-4" />
          {file ? file.name : "Přiložit soubor…"}
        </button>
        {file && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs font-semibold text-ink-500 hover:text-berry"
          >
            Odebrat
          </button>
        )}
      </div>
    </div>
  );
}

/** Chip(y) s odkazem na přiložené dokumenty pod záznamem. */
function AttachmentChips({ docs }: { docs?: RecordDoc[] }) {
  if (!docs || docs.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {docs.map((d) =>
        d.url ? (
          <a
            key={d.id}
            href={d.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-sage-100 px-2 py-0.5 text-[11px] font-semibold text-sage-700 hover:bg-sage-200"
          >
            <Paperclip className="size-3" /> {d.title}
          </a>
        ) : (
          <span
            key={d.id}
            className="inline-flex items-center gap-1 rounded-full bg-ink-900/8 px-2 py-0.5 text-[11px] font-semibold text-ink-400"
          >
            <Paperclip className="size-3" /> {d.title}
          </span>
        ),
      )}
    </div>
  );
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
        (() => {
          const grid =
            "sm:grid-cols-[8rem_7rem_7rem_minmax(0,1fr)_2.5rem]";
          return (
            <div>
              <TableHead
                cols={["Datum", "Váha", "Změna", "Poznámka", ""]}
                grid={grid}
              />
              <div className="divide-y divide-ink-900/8">
                {rows.map((r, i) => {
                  // rows jsou seřazené sestupně → předchozí měření je další v poli.
                  const prev = rows[i + 1];
                  const delta =
                    prev != null ? r.weight_kg - prev.weight_kg : null;
                  return (
                    <Row key={r.id} grid={grid}>
                      <Cell label="Datum" className="text-ink-500">
                        {formatDate(r.measured_at)}
                      </Cell>
                      <Cell label="Váha">
                        <span className="font-display text-base font-bold text-ink-900">
                          {r.weight_kg} kg
                        </span>
                        {i === 0 && (
                          <span className="ml-2 rounded-full bg-meadow-100 px-2 py-0.5 text-[11px] font-semibold text-meadow-700">
                            aktuální
                          </span>
                        )}
                      </Cell>
                      <Cell label="Změna">
                        {delta == null || delta === 0 ? (
                          <span className="text-ink-400">—</span>
                        ) : (
                          <span
                            className={cn(
                              "font-semibold",
                              delta > 0
                                ? "text-meadow-600"
                                : "text-terracotta-600",
                            )}
                          >
                            {delta > 0 ? "▲" : "▼"}{" "}
                            {Math.abs(delta).toFixed(2)} kg
                          </span>
                        )}
                      </Cell>
                      <Cell label="Poznámka" className="text-ink-600">
                        {r.note || <span className="text-ink-400">—</span>}
                      </Cell>
                      <ActionCell>
                        <DeleteButton
                          table="weight_logs"
                          entryId={r.id}
                          animalId={animalId}
                        />
                      </ActionCell>
                    </Row>
                  );
                })}
              </div>
            </div>
          );
        })()
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
  docsByRecord,
}: {
  animalId: string;
  rows: VaccinationRow[];
  docsByRecord?: Record<string, RecordDoc[]>;
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
        (() => {
          const grid =
            "sm:grid-cols-[minmax(0,1.3fr)_7rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)_2.5rem]";
          return (
            <div>
              <TableHead
                cols={[
                  "Vakcína",
                  "Podáno",
                  "Platí do",
                  "Veterinář",
                  "Poznámka",
                  "",
                ]}
                grid={grid}
              />
              <div className="divide-y divide-ink-900/8">
                {rows.map((r) => {
                  const d = daysUntil(r.valid_until);
                  return (
                    <Row key={r.id} grid={grid}>
                      <Cell label="Vakcína">
                        <span className="font-semibold text-ink-900">
                          {r.vaccine}
                        </span>
                        <AttachmentChips docs={docsByRecord?.[r.id]} />
                      </Cell>
                      <Cell label="Podáno" className="text-ink-500">
                        {formatDate(r.administered_at)}
                      </Cell>
                      <Cell label="Platí do">
                        {r.valid_until ? (
                          <span className="inline-flex flex-wrap items-center gap-1.5">
                            <span className="text-ink-700">
                              {formatDate(r.valid_until)}
                            </span>
                            {d != null && d < 0 && (
                              <span className="rounded-full bg-peach-200 px-2 py-0.5 text-[11px] font-semibold text-terracotta-600">
                                Vypršelo
                              </span>
                            )}
                            {d != null && d >= 0 && d <= 30 && (
                              <span className="rounded-full bg-sunshine-200 px-2 py-0.5 text-[11px] font-semibold text-sunshine-600">
                                Brzy vyprší
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </Cell>
                      <Cell label="Veterinář" className="text-ink-600">
                        {r.vet_name || <span className="text-ink-400">—</span>}
                      </Cell>
                      <Cell label="Poznámka" className="text-ink-600">
                        {r.notes || <span className="text-ink-400">—</span>}
                      </Cell>
                      <ActionCell>
                        <DeleteButton
                          table="vaccinations"
                          entryId={r.id}
                          animalId={animalId}
                        />
                      </ActionCell>
                    </Row>
                  );
                })}
              </div>
            </div>
          );
        })()
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
  const [file, setFile] = useState<File | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          let doc: AttachedDoc | null = null;
          if (file) {
            try {
              doc = await uploadDoc(file);
            } catch (err) {
              return {
                error: err instanceof Error ? err.message : "Nahrání selhalo.",
              };
            }
          }
          return addVaccination(
            animalId,
            {
              vaccine,
              administered_at: administered,
              valid_until: validUntil,
              vet_name: vet,
              notes,
            },
            doc,
          );
        }, close);
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
      {validUntil && (
        <p className="mt-2 text-xs text-ink-500">
          Připomínka přeočkování se vytvoří automaticky 14 dní před koncem
          platnosti.
        </p>
      )}
      <div className="mt-3">
        <Field label="Poznámka">
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={inputCls}
          />
        </Field>
      </div>
      <DocAttachField file={file} onChange={setFile} />
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
  docsByRecord,
}: {
  animalId: string;
  rows: TreatmentRow[];
  docsByRecord?: Record<string, RecordDoc[]>;
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
        (() => {
          const grid =
            "sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_8rem_minmax(0,1fr)_minmax(0,1fr)_2.5rem]";
          return (
            <div>
              <TableHead
                cols={[
                  "Název / typ",
                  "Dávkování",
                  "Období",
                  "Další dávka",
                  "Veterinář",
                  "",
                ]}
                grid={grid}
              />
              <div className="divide-y divide-ink-900/8">
                {rows.map((r) => {
                  const overdue = r.next_due != null && r.next_due <= todayStr;
                  const ended = r.end_date != null && r.end_date < todayStr;
                  const dosing = [r.dosage, r.frequency]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <Row key={r.id} grid={grid} muted={ended}>
                      <Cell label="Název">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-ink-900">
                            {r.name}
                          </span>
                          <span className="rounded-full bg-sage-100 px-2 py-0.5 text-[11px] font-semibold text-sage-700">
                            {TREATMENT_TYPE_LABEL[r.type]}
                          </span>
                          {ended && (
                            <span className="rounded-full bg-ink-900/8 px-2 py-0.5 text-[11px] font-semibold text-ink-500">
                              Ukončeno
                            </span>
                          )}
                        </div>
                        {r.notes && (
                          <p className="mt-0.5 text-sm text-ink-600">
                            {r.notes}
                          </p>
                        )}
                        <AttachmentChips docs={docsByRecord?.[r.id]} />
                      </Cell>
                      <Cell label="Dávkování" className="text-ink-600">
                        {dosing || <span className="text-ink-400">—</span>}
                      </Cell>
                      <Cell label="Období" className="text-ink-500">
                        {r.start_date || r.end_date ? (
                          <>
                            {r.start_date ? formatDate(r.start_date) : "?"}
                            {" – "}
                            {r.end_date ? formatDate(r.end_date) : "…"}
                          </>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </Cell>
                      <Cell label="Další dávka">
                        {r.next_due ? (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                              overdue
                                ? "bg-peach-200 text-terracotta-600"
                                : "bg-sunshine-200 text-sunshine-600",
                            )}
                          >
                            {formatDate(r.next_due)}
                          </span>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </Cell>
                      <Cell label="Veterinář" className="text-ink-600">
                        {r.vet_name || <span className="text-ink-400">—</span>}
                      </Cell>
                      <ActionCell>
                        <DeleteButton
                          table="treatments"
                          entryId={r.id}
                          animalId={animalId}
                        />
                      </ActionCell>
                    </Row>
                  );
                })}
              </div>
            </div>
          );
        })()
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
  const [file, setFile] = useState<File | null>(null);
  const [recurrence, setRecurrence] = useState<string>("none");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          let doc: AttachedDoc | null = null;
          if (file) {
            try {
              doc = await uploadDoc(file);
            } catch (err) {
              return {
                error: err instanceof Error ? err.message : "Nahrání selhalo.",
              };
            }
          }
          return addTreatment(
            animalId,
            {
              type,
              name,
              dosage,
              frequency,
              start_date: startDate,
              end_date: endDate,
              next_due: nextDue,
              vet_name: vet,
              notes,
            },
            doc,
            TREATMENT_RECURRENCE[recurrence]?.schedule ?? null,
          );
        }, close);
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
      <div className="mt-3">
        <Field label="Automatické denní úkoly">
          <select
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value)}
            className={inputCls}
          >
            {RECURRENCE_KEYS.map((k) => (
              <option key={k} value={k}>
                {TREATMENT_RECURRENCE[k].label}
              </option>
            ))}
          </select>
        </Field>
        {recurrence !== "none" && (
          <p className="mt-1.5 text-xs text-ink-500">
            Vytvoří se opakované úkoly s dávkou{" "}
            {dosage.trim() ? `„${dosage.trim()}" ` : ""}od{" "}
            {startDate || "dneška"}
            {endDate ? ` do ${endDate}` : ""}. Úkoly najdeš v záložce Úkoly.
          </p>
        )}
      </div>
      <DocAttachField file={file} onChange={setFile} />
      <SubmitRow pending={pending} error={error} onCancel={close} />
    </form>
  );
}

// ---- Veterinární záznamy --------------------------------------------------

export function VetRecordSection({
  animalId,
  rows,
  docsByRecord,
}: {
  animalId: string;
  rows: VetRecordRow[];
  docsByRecord?: Record<string, RecordDoc[]>;
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
        (() => {
          const grid =
            "sm:grid-cols-[8rem_minmax(0,1.5fr)_minmax(0,1fr)_2.5rem]";
          return (
            <div>
              <TableHead
                cols={["Datum", "Záznam", "Veterinář", ""]}
                grid={grid}
              />
              <div className="divide-y divide-ink-900/8">
                {rows.map((r) => (
                  <Row key={r.id} grid={grid}>
                    <Cell label="Datum" className="text-ink-500">
                      {formatDate(r.recorded_at)}
                    </Cell>
                    <Cell label="Záznam">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-ink-900">
                          {r.title}
                        </span>
                        {r.category && (
                          <span className="rounded-full bg-ink-900/8 px-2 py-0.5 text-[11px] font-semibold text-ink-600">
                            {r.category}
                          </span>
                        )}
                      </div>
                      {r.notes && (
                        <p className="mt-0.5 whitespace-pre-line text-sm text-ink-600">
                          {r.notes}
                        </p>
                      )}
                      <AttachmentChips docs={docsByRecord?.[r.id]} />
                    </Cell>
                    <Cell label="Veterinář" className="text-ink-600">
                      {r.vet_name || <span className="text-ink-400">—</span>}
                    </Cell>
                    <ActionCell>
                      <DeleteButton
                        table="vet_records"
                        entryId={r.id}
                        animalId={animalId}
                      />
                    </ActionCell>
                  </Row>
                ))}
              </div>
            </div>
          );
        })()
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
  const [file, setFile] = useState<File | null>(null);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(async () => {
          let doc: AttachedDoc | null = null;
          if (file) {
            try {
              doc = await uploadDoc(file);
            } catch (err) {
              return {
                error: err instanceof Error ? err.message : "Nahrání selhalo.",
              };
            }
          }
          return addVetRecord(
            animalId,
            {
              recorded_at: recordedAt,
              category,
              title,
              vet_name: vet,
              notes,
            },
            doc,
          );
        }, close);
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
      <DocAttachField file={file} onChange={setFile} />
      <SubmitRow pending={pending} error={error} onCancel={close} />
    </form>
  );
}
