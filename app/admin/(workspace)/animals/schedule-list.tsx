"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Pause,
  PawPrint,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";

import { AddTaskForm } from "./task-list";

import {
  ANIMAL_TASK_PRIORITY_LABEL,
  ANIMAL_TASK_PRIORITY_PILL,
  ANIMAL_TASK_TYPE_LABEL,
  TASK_SCHEDULE_FREQ_LABEL,
  taskScheduleSummary,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  AnimalTaskPriority,
  AnimalTaskType,
  TaskScheduleFreq,
} from "@/types/database";

import {
  createTaskSchedule,
  deleteTaskSchedule,
  setScheduleActive,
} from "./schedule-actions";

export interface ScheduleItem {
  id: string;
  type: AnimalTaskType;
  priority: AnimalTaskPriority;
  title: string;
  description: string | null;
  freq: TaskScheduleFreq;
  interval: number;
  next_run: string;
  end_date: string | null;
  lead_days: number;
  active: boolean;
  animal_id: string | null;
  animal_name: string | null;
}

export interface AnimalOption {
  id: string;
  name: string;
}

const TASK_TYPES: AnimalTaskType[] = [
  "custom",
  "vaccination",
  "treatment",
  "deworming",
  "vet_checkup",
  "grooming",
  "adoption_followup",
];
const TASK_PRIORITIES: AnimalTaskPriority[] = ["high", "normal", "low"];
const FREQS: TaskScheduleFreq[] = ["daily", "weekly", "monthly", "yearly"];

const today = () => new Date().toISOString().slice(0, 10);

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

const inputCls =
  "w-full rounded-xl bg-cream-warm px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300";

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

export function AddScheduleForm({
  animalId,
  animals,
  open: controlledOpen,
  onOpenChange,
  hideTrigger = false,
}: {
  animalId: string | null;
  animals?: AnimalOption[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
}) {
  const router = useRouter();
  const [openInternal, setOpenInternal] = useState(false);
  const open = controlledOpen ?? openInternal;
  const setOpen = (v: boolean) =>
    onOpenChange ? onOpenChange(v) : setOpenInternal(v);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<AnimalTaskType>("custom");
  const [priority, setPriority] = useState<AnimalTaskPriority>("normal");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [freq, setFreq] = useState<TaskScheduleFreq>("monthly");
  const [interval, setIntervalVal] = useState("1");
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState("");
  const [leadDays, setLeadDays] = useState("0");
  const [selectedAnimal, setSelectedAnimal] = useState("");

  const showAnimalPicker = animalId === null && !!animals?.length;

  function reset() {
    setOpen(false);
    setType("custom");
    setPriority("normal");
    setTitle("");
    setDescription("");
    setFreq("monthly");
    setIntervalVal("1");
    setStartDate(today());
    setEndDate("");
    setLeadDays("0");
    setSelectedAnimal("");
    setError(null);
  }

  return (
    <div>
      {!hideTrigger && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => (open ? reset() : setOpen(true))}
            className="inline-flex items-center gap-1.5 rounded-pill bg-cream-warm px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-ink-900/10 hover:bg-cream"
          >
            {open ? (
              <X className="size-4" />
            ) : (
              <CalendarClock className="size-4" />
            )}
            {open ? "Zavřít" : "Nové opakování"}
          </button>
        </div>
      )}

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const res = await createTaskSchedule({
                animalId: showAnimalPicker ? selectedAnimal || null : animalId,
                type,
                priority,
                title,
                description,
                freq,
                interval: Number(interval) || 1,
                start_date: startDate,
                end_date: endDate,
                lead_days: Number(leadDays) || 0,
              });
              if ("error" in res) {
                setError(res.error);
                return;
              }
              reset();
              router.refresh();
            });
          }}
          className="mt-3 rounded-2xl bg-cream p-5 ring-1 ring-ink-900/8"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Název">
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Co se má pravidelně dělat"
                className={inputCls}
              />
            </Field>
            <Field label="Typ">
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AnimalTaskType)}
                className={inputCls}
              >
                {TASK_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {ANIMAL_TASK_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Frekvence">
              <select
                value={freq}
                onChange={(e) => setFreq(e.target.value as TaskScheduleFreq)}
                className={inputCls}
              >
                {FREQS.map((f) => (
                  <option key={f} value={f}>
                    {TASK_SCHEDULE_FREQ_LABEL[f]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Každých (interval)">
              <input
                type="number"
                min={1}
                value={interval}
                onChange={(e) => setIntervalVal(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="První výskyt">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Opakovat do (volitelné)">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Priorita">
              <select
                value={priority}
                onChange={(e) =>
                  setPriority(e.target.value as AnimalTaskPriority)
                }
                className={inputCls}
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {ANIMAL_TASK_PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Předstih (dní před termínem)">
              <input
                type="number"
                min={0}
                value={leadDays}
                onChange={(e) => setLeadDays(e.target.value)}
                className={inputCls}
              />
            </Field>
            {showAnimalPicker && (
              <Field label="Zvíře">
                <select
                  value={selectedAnimal}
                  onChange={(e) => setSelectedAnimal(e.target.value)}
                  className={inputCls}
                >
                  <option value="">Bez zvířete (celý útulek)</option>
                  {animals!.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
          <div className="mt-3">
            <Field label="Popis">
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
          <p className="mt-2 text-xs text-ink-500">
            Úkol se bude automaticky vytvářet {taskScheduleSummary(
              freq,
              Number(interval) || 1,
            ).toLowerCase()}
            , vždy s předstihem {Number(leadDays) || 0} dní.
          </p>
          <div className="mt-3 flex items-center justify-end gap-2">
            {error && (
              <span className="mr-auto text-xs text-berry">{error}</span>
            )}
            <button
              type="button"
              onClick={reset}
              className="rounded-pill px-3 py-1.5 text-sm font-semibold text-ink-600 hover:bg-cream-warm"
            >
              Zrušit
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-pill bg-meadow-500 px-4 py-1.5 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
            >
              {pending ? "Ukládám…" : "Vytvořit"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

/**
 * Společná lišta s tlačítky „Nový úkol" a „Nové opakování" vedle sebe.
 * Otevře se vždy jen jeden panel; oba formuláře se vykreslí pod lištou.
 */
export function TaskCreateBar({
  animalId,
  animals,
}: {
  animalId: string | null;
  animals?: AnimalOption[];
}) {
  const [panel, setPanel] = useState<"task" | "schedule" | null>(null);
  const toggle = (p: "task" | "schedule") =>
    setPanel((cur) => (cur === p ? null : p));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => toggle("task")}
          className="inline-flex items-center gap-1.5 rounded-pill bg-ink-900 px-4 py-2 text-sm font-semibold text-cream hover:bg-ink-800"
        >
          {panel === "task" ? (
            <X className="size-4" />
          ) : (
            <Plus className="size-4" />
          )}
          {panel === "task" ? "Zavřít" : "Nový úkol"}
        </button>
        <button
          type="button"
          onClick={() => toggle("schedule")}
          className="inline-flex items-center gap-1.5 rounded-pill bg-cream-warm px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-ink-900/10 hover:bg-cream"
        >
          {panel === "schedule" ? (
            <X className="size-4" />
          ) : (
            <CalendarClock className="size-4" />
          )}
          {panel === "schedule" ? "Zavřít" : "Nové opakování"}
        </button>
      </div>

      <AddTaskForm
        animalId={animalId}
        animals={animals}
        hideTrigger
        open={panel === "task"}
        onOpenChange={(o) => setPanel(o ? "task" : null)}
      />
      <AddScheduleForm
        animalId={animalId}
        animals={animals}
        hideTrigger
        open={panel === "schedule"}
        onOpenChange={(o) => setPanel(o ? "schedule" : null)}
      />
    </div>
  );
}

function ScheduleRow({
  s,
  showAnimal,
}: {
  s: ScheduleItem;
  showAnimal: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<{ error: string } | { ok: true }>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-2xl bg-cream p-4 ring-1 ring-ink-900/8",
        !s.active && "opacity-60",
      )}
    >
      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-meadow-50 text-meadow-600">
        <CalendarClock className="size-3.5" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold text-ink-900">{s.title}</span>
          <span className="rounded-full bg-ink-900/8 px-2 py-0.5 text-xs font-semibold text-ink-600">
            {ANIMAL_TASK_TYPE_LABEL[s.type]}
          </span>
          <span className="rounded-full bg-sage-100 px-2 py-0.5 text-xs font-semibold text-sage-700">
            {taskScheduleSummary(s.freq, s.interval)}
          </span>
          {s.priority !== "normal" && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                ANIMAL_TASK_PRIORITY_PILL[s.priority],
              )}
            >
              {ANIMAL_TASK_PRIORITY_LABEL[s.priority]}
            </span>
          )}
          {!s.active && (
            <span className="rounded-full bg-ink-900/8 px-2 py-0.5 text-xs font-semibold text-ink-500">
              Pozastaveno
            </span>
          )}
        </div>
        <div className="mt-1 text-sm text-ink-500">
          {s.active ? "Příští: " : "Naplánováno: "}
          <span className="font-semibold text-ink-700">
            {formatDate(s.next_run)}
          </span>
          {s.lead_days > 0 && <> · předstih {s.lead_days} dní</>}
          {s.end_date && <> · do {formatDate(s.end_date)}</>}
        </div>
        {showAnimal && s.animal_id && s.animal_name && (
          <Link
            href={`/admin/animals/${s.animal_id}/ukoly`}
            className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-meadow-600 hover:text-meadow-700"
          >
            <PawPrint className="size-3.5" /> {s.animal_name}
          </Link>
        )}
        {s.description && (
          <p className="mt-1 whitespace-pre-line text-sm text-ink-600">
            {s.description}
          </p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => setScheduleActive(s.id, !s.active))}
          aria-label={s.active ? "Pozastavit" : "Obnovit"}
          title={s.active ? "Pozastavit" : "Obnovit"}
          className="rounded-full p-1.5 text-ink-400 hover:bg-cream-warm hover:text-ink-700"
        >
          {s.active ? <Pause className="size-4" /> : <Play className="size-4" />}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => deleteTaskSchedule(s.id))}
          aria-label="Smazat opakování"
          className="rounded-full p-1.5 text-ink-400 hover:bg-cream-warm hover:text-berry"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}

export function ScheduleList({
  schedules,
  showAnimal = false,
}: {
  schedules: ScheduleItem[];
  showAnimal?: boolean;
}) {
  if (schedules.length === 0) return null;
  const sorted = [...schedules].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.next_run.localeCompare(b.next_run);
  });
  return (
    <ul className="space-y-2">
      {sorted.map((s) => (
        <ScheduleRow key={s.id} s={s} showAnimal={showAnimal} />
      ))}
    </ul>
  );
}

/** Souhrnná sekce „Pravidelné úkoly" — jen seznam šablon (tlačítko je v liště). */
export function ScheduleSection({
  schedules,
  showAnimal = false,
}: {
  schedules: ScheduleItem[];
  showAnimal?: boolean;
}) {
  if (schedules.length === 0) return null;
  const active = schedules.filter((s) => s.active).length;
  return (
    <section className="space-y-3 rounded-3xl bg-sage-50 p-5 ring-1 ring-ink-900/8">
      <div>
        <h3 className="flex items-center gap-2 font-display text-lg font-bold text-ink-900">
          <CalendarClock className="size-5 text-meadow-600" />
          Pravidelné úkoly
          {active > 0 && (
            <span className="text-sm font-semibold text-ink-400">{active}</span>
          )}
        </h3>
        <p className="text-sm text-ink-500">
          Šablony, ze kterých systém automaticky vytváří úkoly s termínem.
        </p>
      </div>
      <ScheduleList schedules={schedules} showAnimal={showAnimal} />
    </section>
  );
}
