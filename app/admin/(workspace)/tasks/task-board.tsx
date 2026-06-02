"use client";

import { useMemo, useState } from "react";

import { matchesSourceFilter, TASK_SOURCE_FILTERS, type TaskSourceKey } from "@/lib/animal-tasks";
import { cn } from "@/lib/utils";

import { TaskList, type TaskItem } from "../animals/task-list";

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

export function TaskBoard({
  tasks,
  defaultMine = false,
}: {
  tasks: TaskItem[];
  defaultMine?: boolean;
}) {
  const [source, setSource] = useState<TaskSourceKey | "all">("all");
  const [mine, setMine] = useState(defaultMine);
  const [highOnly, setHighOnly] = useState(false);

  const todayStr = iso(new Date());
  const weekEnd = iso(new Date(Date.now() + 7 * DAY));

  // Statistiky (z otevřených úkolů, bez ohledu na filtry).
  const stats = useMemo(() => {
    let over = 0;
    let today = 0;
    let week = 0;
    for (const t of tasks) {
      if (!t.due_date) continue;
      if (t.due_date < todayStr) over++;
      else if (t.due_date === todayStr) today++;
      else if (t.due_date <= weekEnd) week++;
    }
    return { over, today, week };
  }, [tasks, todayStr, weekEnd]);

  // Počty pro filtry zdroje.
  const sourceCounts = useMemo(() => {
    const m = new Map<TaskSourceKey | "all", number>();
    for (const f of TASK_SOURCE_FILTERS) {
      m.set(f.key, tasks.filter((t) => matchesSourceFilter(t.type, f.key)).length);
    }
    return m;
  }, [tasks]);

  const mineCount = useMemo(() => tasks.filter((t) => t.assignee_name === "já").length, [tasks]);
  const highCount = useMemo(() => tasks.filter((t) => t.priority === "high").length, [tasks]);

  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        if (!matchesSourceFilter(t.type, source)) return false;
        if (mine && t.assignee_name !== "já") return false;
        if (highOnly && t.priority !== "high") return false;
        return true;
      }),
    [tasks, source, mine, highOnly],
  );

  return (
    <div className="space-y-5">
      {/* Statistiky */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile n={stats.over} label="🔴 Po termínu" tone="bg-peach-100 text-terracotta-600 ring-terracotta-400/30" />
        <StatTile n={stats.today} label="🟡 Dnes" tone="bg-sunshine-200 text-sunshine-600 ring-sunshine-400/40" />
        <StatTile n={stats.week} label="📅 Tento týden" tone="bg-cream text-ink-700 ring-ink-900/8" />
      </div>

      {/* Filtry zdroje */}
      <div className="flex flex-wrap gap-2">
        {TASK_SOURCE_FILTERS.map((f) => {
          const on = source === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setSource(f.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-pill border-[1.5px] px-3 py-1.5 text-xs font-bold transition-colors",
                on
                  ? "border-ink-900 bg-ink-900 text-cream"
                  : "border-ink-900/15 bg-cream text-ink-700 hover:border-ink-900/30",
              )}
            >
              {f.icon && <span>{f.icon}</span>}
              {f.label}
              <span className={cn("text-[11px]", on ? "text-cream/70" : "text-ink-400")}>
                {sourceCounts.get(f.key) ?? 0}
              </span>
            </button>
          );
        })}
      </div>

      {/* Rychlé přepínače */}
      <div className="flex flex-wrap gap-2">
        <Toggle on={mine} onClick={() => setMine((v) => !v)} label={`👤 Moje úkoly`} count={mineCount} />
        <Toggle on={highOnly} onClick={() => setHighOnly((v) => !v)} label="🔺 Vysoká priorita" count={highCount} />
      </div>

      <TaskList
        tasks={filtered}
        showAnimal
        groupByDue
        emptyText="Žádné úkoly pro tento filtr. 🎉"
      />
    </div>
  );
}

function StatTile({ n, label, tone }: { n: number; label: string; tone: string }) {
  return (
    <div className={cn("rounded-2xl p-4 ring-1 ring-inset", tone)}>
      <div className="font-display text-3xl font-bold leading-none">{n}</div>
      <div className="mt-1 text-xs font-bold text-ink-500">{label}</div>
    </div>
  );
}

function Toggle({
  on,
  onClick,
  label,
  count,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border-[1.5px] px-3 py-1.5 text-xs font-bold transition-colors",
        on
          ? "border-meadow-500 bg-meadow-50 text-meadow-700"
          : "border-ink-900/15 bg-cream text-ink-700 hover:border-meadow-500",
      )}
    >
      {label}
      <span className={cn("text-[11px]", on ? "text-meadow-600" : "text-ink-400")}>{count}</span>
    </button>
  );
}
