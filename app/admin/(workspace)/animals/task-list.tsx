"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Clock, RotateCcw, Trash2, X, Plus, PawPrint, ArrowUpRight } from "lucide-react";

import {
  ANIMAL_TASK_PRIORITY_LABEL,
  ANIMAL_TASK_PRIORITY_PILL,
  ANIMAL_TASK_PRIORITY_RANK,
  ANIMAL_TASK_STATUS_LABEL,
  ANIMAL_TASK_TYPE_LABEL,
} from "@/lib/format";
import { taskOpenHref, taskSourceMeta } from "@/lib/animal-tasks";
import { cn } from "@/lib/utils";
import type {
  AnimalTaskPriority,
  AnimalTaskStatus,
  AnimalTaskType,
} from "@/types/database";

import {
  completeTask,
  createManualTask,
  deleteTask,
  dismissTask,
  reopenTask,
  snoozeTask,
} from "./task-actions";

export interface TaskItem {
  id: string;
  type: AnimalTaskType;
  priority: AnimalTaskPriority;
  title: string;
  description: string | null;
  due_date: string | null;
  status: AnimalTaskStatus;
  source: "manual" | "auto";
  animal_id: string | null;
  animal_name: string | null;
  assigned_to?: string | null;
  assignee_name?: string | null;
}

const SNOOZE_OPTIONS: { label: string; days: number }[] = [
  { label: "Zítra", days: 1 },
  { label: "+3 dny", days: 3 },
  { label: "+1 týden", days: 7 },
];

const TASK_TYPES: AnimalTaskType[] = [
  "custom",
  "vaccination",
  "treatment",
  "deworming",
  "vet_checkup",
  "grooming",
  "long_stay",
  "adoption_followup",
];

const TASK_PRIORITIES: AnimalTaskPriority[] = ["high", "normal", "low"];

const today = () => new Date().toISOString().slice(0, 10);

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

function dueMeta(due: string | null, status: AnimalTaskStatus) {
  if (!due || status !== "open") return null;
  const todayStr = today();
  if (due < todayStr)
    return { cls: "bg-peach-200 text-terracotta-600", label: "Po termínu" };
  if (due === todayStr)
    return { cls: "bg-sunshine-200 text-sunshine-600", label: "Dnes" };
  return { cls: "bg-sage-100 text-sage-700", label: formatDate(due) };
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

export interface AnimalOption {
  id: string;
  name: string;
}

export function AddTaskForm({
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
  const [dueDate, setDueDate] = useState("");
  const [selectedAnimal, setSelectedAnimal] = useState("");

  // Výběr zvířete ukazujeme jen v inboxu (úkol není pevně vázaný na zvíře).
  const showAnimalPicker = animalId === null && !!animals?.length;

  function reset() {
    setOpen(false);
    setType("custom");
    setPriority("normal");
    setTitle("");
    setDescription("");
    setDueDate("");
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
            className="inline-flex items-center gap-1.5 rounded-pill bg-ink-900 px-4 py-2 text-sm font-semibold text-cream hover:bg-ink-800"
          >
            {open ? <X className="size-4" /> : <Plus className="size-4" />}
            {open ? "Zavřít" : "Nový úkol"}
          </button>
        </div>
      )}

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            startTransition(async () => {
              const res = await createManualTask({
                animalId: showAnimalPicker ? selectedAnimal || null : animalId,
                type,
                priority,
                title,
                description,
                due_date: dueDate,
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
                placeholder="Co je potřeba udělat"
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
            <Field label="Termín">
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
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
                  <option value="">Bez zvířete</option>
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

function TaskRow({
  task,
  showAnimal,
}: {
  task: TaskItem;
  showAnimal: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  function run(fn: () => Promise<{ error: string } | { ok: true }>) {
    startTransition(async () => {
      await fn();
      router.refresh();
    });
  }

  const meta = dueMeta(task.due_date, task.status);
  const done = task.status === "done";
  const dismissed = task.status === "dismissed";
  const src = taskSourceMeta(task.type);
  const open = !done && !dismissed;

  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-2xl bg-cream p-4 ring-1 ring-ink-900/8",
        (done || dismissed) && "opacity-60",
      )}
    >
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => (done ? reopenTask(task.id) : completeTask(task.id)))}
        aria-label={done ? "Znovu otevřít" : "Označit jako hotové"}
        className={cn(
          "mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors disabled:opacity-50",
          done
            ? "border-sage-500 bg-sage-500 text-cream"
            : "border-ink-900/20 hover:border-sage-500",
        )}
      >
        {done && <Check className="size-3.5" />}
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "font-semibold text-ink-900",
              done && "line-through",
            )}
          >
            {task.title}
          </span>
          <span
            className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", src.tone)}
            title={ANIMAL_TASK_TYPE_LABEL[task.type]}
          >
            {src.label}
          </span>
          {task.priority !== "normal" && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                ANIMAL_TASK_PRIORITY_PILL[task.priority],
              )}
            >
              {ANIMAL_TASK_PRIORITY_LABEL[task.priority]}
            </span>
          )}
          {task.assignee_name && (
            <span className="rounded-full bg-cream-warm px-2 py-0.5 text-xs font-semibold text-ink-500">
              👤 {task.assignee_name}
            </span>
          )}
          {meta && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                meta.cls,
              )}
            >
              {meta.label}
            </span>
          )}
          {dismissed && (
            <span className="rounded-full bg-ink-900/8 px-2 py-0.5 text-xs font-semibold text-ink-500">
              {ANIMAL_TASK_STATUS_LABEL.dismissed}
            </span>
          )}
        </div>
        {showAnimal && task.animal_id && task.animal_name && (
          <Link
            href={taskOpenHref(task.type, task.animal_id)}
            className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-meadow-600 hover:text-meadow-700"
          >
            <PawPrint className="size-3.5" /> {task.animal_name}
          </Link>
        )}
        {task.description && (
          <p className="mt-1 whitespace-pre-line text-sm text-ink-600">
            {task.description}
          </p>
        )}
      </div>

      <div className="relative flex shrink-0 items-center gap-1">
        {open && task.animal_id && (
          <Link
            href={taskOpenHref(task.type, task.animal_id)}
            aria-label="Otevřít zdrojovou záložku"
            title="Otevřít"
            className="rounded-full p-1.5 text-ink-400 hover:bg-cream-warm hover:text-meadow-600"
          >
            <ArrowUpRight className="size-4" />
          </Link>
        )}
        {open && (
          <button
            type="button"
            disabled={pending}
            onClick={() => setSnoozeOpen((v) => !v)}
            aria-label="Odložit úkol"
            title="Odložit"
            className="rounded-full p-1.5 text-ink-400 hover:bg-cream-warm hover:text-sunshine-600"
          >
            <Clock className="size-4" />
          </button>
        )}
        {snoozeOpen && open && (
          <div className="absolute right-0 top-9 z-20 flex flex-col gap-1 rounded-xl bg-cream p-1.5 shadow-soft-md ring-1 ring-ink-900/10">
            {SNOOZE_OPTIONS.map((o) => (
              <button
                key={o.days}
                type="button"
                disabled={pending}
                onClick={() => {
                  setSnoozeOpen(false);
                  run(() => snoozeTask(task.id, o.days));
                }}
                className="whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-sm font-semibold text-ink-700 hover:bg-cream-warm disabled:opacity-50"
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
        {!done && !dismissed && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => dismissTask(task.id))}
            aria-label="Zrušit úkol"
            className="rounded-full p-1.5 text-ink-400 hover:bg-cream-warm hover:text-ink-700"
          >
            <X className="size-4" />
          </button>
        )}
        {dismissed && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => reopenTask(task.id))}
            aria-label="Znovu otevřít"
            className="rounded-full p-1.5 text-ink-400 hover:bg-cream-warm hover:text-ink-700"
          >
            <RotateCcw className="size-4" />
          </button>
        )}
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => deleteTask(task.id))}
          aria-label="Smazat úkol"
          className="rounded-full p-1.5 text-ink-400 hover:bg-cream-warm hover:text-berry"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
    </li>
  );
}

// Seřazení: vysoká priorita nahoru, pak podle nejbližšího termínu.
function byPriorityThenDue(a: TaskItem, b: TaskItem): number {
  const pr = ANIMAL_TASK_PRIORITY_RANK[a.priority] - ANIMAL_TASK_PRIORITY_RANK[b.priority];
  if (pr !== 0) return pr;
  const da = a.due_date ?? "9999-12-31";
  const db = b.due_date ?? "9999-12-31";
  return da.localeCompare(db);
}

type DueBucket = "overdue" | "today" | "week" | "later" | "none";

const BUCKET_ORDER: DueBucket[] = ["overdue", "today", "week", "later", "none"];
const BUCKET_LABEL: Record<DueBucket, string> = {
  overdue: "Po termínu",
  today: "Dnes",
  week: "Tento týden",
  later: "Později",
  none: "Bez termínu",
};
const BUCKET_ACCENT: Record<DueBucket, string> = {
  overdue: "text-terracotta-600",
  today: "text-sunshine-600",
  week: "text-sage-700",
  later: "text-ink-500",
  none: "text-ink-400",
};

function bucketOf(due: string | null, todayStr: string, weekEnd: string): DueBucket {
  if (!due) return "none";
  if (due < todayStr) return "overdue";
  if (due === todayStr) return "today";
  if (due <= weekEnd) return "week";
  return "later";
}

export function TaskList({
  tasks,
  showAnimal = false,
  emptyText = "Žádné úkoly.",
  groupByDue = false,
}: {
  tasks: TaskItem[];
  showAnimal?: boolean;
  emptyText?: string;
  groupByDue?: boolean;
}) {
  if (tasks.length === 0)
    return (
      <div className="rounded-3xl bg-cream p-12 text-center ring-1 ring-ink-900/8">
        <div className="text-4xl">✅</div>
        <p className="mt-3 text-ink-600">{emptyText}</p>
      </div>
    );

  if (!groupByDue)
    return (
      <ul className="space-y-2">
        {[...tasks].sort(byPriorityThenDue).map((t) => (
          <TaskRow key={t.id} task={t} showAnimal={showAnimal} />
        ))}
      </ul>
    );

  const todayStr = today();
  const weekEnd = new Date(Date.now() + 7 * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const groups = new Map<DueBucket, TaskItem[]>();
  for (const t of tasks) {
    const b = bucketOf(t.due_date, todayStr, weekEnd);
    const list = groups.get(b) ?? [];
    list.push(t);
    groups.set(b, list);
  }

  return (
    <div className="space-y-5">
      {BUCKET_ORDER.filter((b) => groups.has(b)).map((b) => {
        const items = groups.get(b)!.sort(byPriorityThenDue);
        return (
          <div key={b} className="space-y-2">
            <h4
              className={cn(
                "text-xs font-bold uppercase tracking-wide",
                BUCKET_ACCENT[b],
              )}
            >
              {BUCKET_LABEL[b]}{" "}
              <span className="text-ink-400">{items.length}</span>
            </h4>
            <ul className="space-y-2">
              {items.map((t) => (
                <TaskRow key={t.id} task={t} showAnimal={showAnimal} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
