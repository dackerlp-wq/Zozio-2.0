"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  BellOff,
  CalendarDays,
  Check,
  CheckSquare,
  Clock,
  List,
  UserPlus,
  UserMinus,
  X,
} from "lucide-react";

import {
  matchesSourceFilter,
  TASK_SOURCE_FILTERS,
  weekLoad,
  type TaskSourceKey,
  type WeekLoadDay,
} from "@/lib/animal-tasks";
import { cn } from "@/lib/utils";

import { TaskList, type TaskGroupBy, type TaskItem } from "../animals/task-list";
import {
  bulkAssignTasks,
  bulkCompleteTasks,
  bulkDismissTasks,
  bulkSnoozeTasks,
  toggleTaskDigest,
} from "../animals/task-actions";

const DAY = 86_400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

type DueFilter = "overdue" | "today" | "week" | null;

const SNOOZE_PRESETS: { label: string; days: number }[] = [
  { label: "Zítra", days: 1 },
  { label: "+3 dny", days: 3 },
  { label: "Příští týden", days: 7 },
];

const GROUP_OPTIONS: { value: TaskGroupBy; label: string }[] = [
  { value: "urgency", label: "Seskupit: naléhavost" },
  { value: "source", label: "Podle zdroje" },
  { value: "animal", label: "Podle zvířete" },
];

export function TaskBoard({
  tasks,
  defaultMine = false,
  digestEnabled,
  canManageDigest = false,
  members = [],
}: {
  tasks: TaskItem[];
  defaultMine?: boolean;
  digestEnabled: boolean;
  canManageDigest?: boolean;
  members?: { userId: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [view, setView] = useState<"list" | "calendar">("list");
  const [source, setSource] = useState<TaskSourceKey | "all">("all");
  const [mine, setMine] = useState(defaultMine);
  const [highOnly, setHighOnly] = useState(false);
  const [dueFilter, setDueFilter] = useState<DueFilter>(null);
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const [groupBy, setGroupBy] = useState<TaskGroupBy>("urgency");

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [snoozeMenu, setSnoozeMenu] = useState(false);
  const [assignMenu, setAssignMenu] = useState(false);
  const [digest, setDigest] = useState(digestEnabled);

  const todayStr = iso(new Date());
  const weekEnd = iso(new Date(Date.now() + 7 * DAY));

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

  const week = useMemo(() => weekLoad(tasks), [tasks]);

  const sourceCounts = useMemo(() => {
    const m = new Map<TaskSourceKey | "all", number>();
    for (const f of TASK_SOURCE_FILTERS) {
      m.set(f.key, tasks.filter((t) => matchesSourceFilter(t.type, f.key)).length);
    }
    return m;
  }, [tasks]);

  const mineCount = useMemo(
    () => tasks.filter((t) => t.assignee_name === "já").length,
    [tasks],
  );
  const highCount = useMemo(
    () => tasks.filter((t) => t.priority === "high").length,
    [tasks],
  );

  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        if (!matchesSourceFilter(t.type, source)) return false;
        if (mine && t.assignee_name !== "já") return false;
        if (highOnly && t.priority !== "high") return false;
        if (dayFilter) {
          if (!t.due_date || t.due_date.slice(0, 10) !== dayFilter) return false;
        } else if (dueFilter) {
          if (!t.due_date) return false;
          if (dueFilter === "overdue" && t.due_date >= todayStr) return false;
          if (dueFilter === "today" && t.due_date !== todayStr) return false;
          if (dueFilter === "week" && !(t.due_date > todayStr && t.due_date <= weekEnd))
            return false;
        }
        return true;
      }),
    [tasks, source, mine, highOnly, dueFilter, dayFilter, todayStr, weekEnd],
  );

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
    setSnoozeMenu(false);
    setAssignMenu(false);
  }

  function runBulk(fn: () => Promise<{ error: string } | { ok: true }>) {
    startTransition(async () => {
      await fn();
      clearSelection();
      router.refresh();
    });
  }

  const ids = () => [...selected];

  function toggleStat(f: Exclude<DueFilter, null>) {
    setDayFilter(null);
    setDueFilter((cur) => (cur === f ? null : f));
  }

  function clickDay(d: WeekLoadDay) {
    setDueFilter(null);
    setDayFilter((cur) => (cur === d.date ? null : d.date));
  }

  return (
    <div className="space-y-5">
      {/* Hlavička akcí: ranní souhrn + přepínač zobrazení */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!canManageDigest || pending}
          onClick={() =>
            startTransition(async () => {
              const next = !digest;
              setDigest(next);
              const res = await toggleTaskDigest(next);
              if ("error" in res) setDigest(!next);
            })
          }
          title={
            canManageDigest
              ? "Přepnout ranní e-mailový souhrn"
              : "Nastavení může měnit jen vedoucí"
          }
          className={cn(
            "inline-flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-bold transition-colors",
            digest
              ? "bg-fern-50 text-fern-700 ring-1 ring-fern-600/20"
              : "bg-cream-warm text-ink-500 ring-1 ring-ink-900/10",
            !canManageDigest && "cursor-default opacity-80",
          )}
        >
          {digest ? <Bell className="size-3.5" /> : <BellOff className="size-3.5" />}
          Ranní souhrn e-mailem: {digest ? "zapnuto" : "vypnuto"}
        </button>

        <div className="ml-auto inline-flex overflow-hidden rounded-pill ring-1 ring-ink-900/15">
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold",
              view === "list" ? "bg-ink-900 text-cream" : "bg-cream text-ink-600",
            )}
          >
            <List className="size-3.5" /> Seznam
          </button>
          <button
            type="button"
            onClick={() => setView("calendar")}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold",
              view === "calendar" ? "bg-ink-900 text-cream" : "bg-cream text-ink-600",
            )}
          >
            <CalendarDays className="size-3.5" /> Kalendář
          </button>
        </div>
      </div>

      {/* Statistiky (klikací filtry) */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          n={stats.over}
          label="🔴 Po termínu"
          tone="bg-peach-100 text-terracotta-600 ring-terracotta-400/30"
          active={dueFilter === "overdue"}
          onClick={() => toggleStat("overdue")}
        />
        <StatTile
          n={stats.today}
          label="🟡 Dnes"
          tone="bg-sunshine-200 text-sunshine-600 ring-sunshine-400/40"
          active={dueFilter === "today"}
          onClick={() => toggleStat("today")}
        />
        <StatTile
          n={stats.week}
          label="📅 Tento týden"
          tone="bg-cream text-ink-700 ring-ink-900/8"
          active={dueFilter === "week"}
          onClick={() => toggleStat("week")}
        />
      </div>

      {/* Nálož týdne */}
      <div className="grid grid-cols-7 gap-2">
        {week.map((d) => {
          const on = dayFilter === d.date;
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => clickDay(d)}
              className={cn(
                "rounded-xl border px-1 py-2 text-center transition-colors",
                d.isToday
                  ? "border-meadow-400 bg-meadow-50"
                  : "border-ink-900/10 bg-cream hover:border-ink-900/25",
                on && "ring-2 ring-meadow-400",
              )}
            >
              <div className="text-[11px] font-bold text-ink-400">
                {d.label}
                {d.isToday && " · dnes"}
              </div>
              <div className="font-display text-lg font-bold leading-tight text-ink-900">
                {d.count || "·"}
              </div>
              <div className="text-[9px] leading-none">
                {d.heavy ? "🔺" : d.isToday && d.count ? "🟡" : " "}
              </div>
            </button>
          );
        })}
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
        <Toggle on={mine} onClick={() => setMine((v) => !v)} label="👤 Moje úkoly" count={mineCount} />
        <Toggle
          on={highOnly}
          onClick={() => setHighOnly((v) => !v)}
          label="🔺 Vysoká priorita"
          count={highCount}
        />
      </div>

      {view === "list" && (
        <>
          {/* Nástroje: vybrat více + seskupení */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setSelectMode((v) => !v);
                clearSelection();
              }}
              className={cn(
                "inline-flex items-center gap-1.5 text-sm font-bold transition-colors",
                selectMode ? "text-meadow-600" : "text-ink-500 hover:text-ink-700",
              )}
            >
              <CheckSquare className="size-4" />
              {selectMode ? "Zrušit výběr" : "Vybrat více"}
            </button>
            <div className="ml-auto">
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as TaskGroupBy)}
                className="rounded-pill border-[1.5px] border-ink-900/15 bg-cream px-3 py-1.5 text-xs font-bold text-ink-700 focus:outline-none focus:ring-2 focus:ring-meadow-300"
              >
                {GROUP_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Hromadná lišta */}
          {selectMode && selected.size > 0 && (
            <div className="relative flex flex-wrap items-center gap-2 rounded-pill bg-ink-900 px-4 py-2 text-cream">
              <span className="text-sm font-bold">✓ {selected.size} vybrané</span>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <BulkBtn
                  disabled={pending}
                  onClick={() => runBulk(() => bulkCompleteTasks(ids()))}
                >
                  <Check className="size-3.5" /> Hotovo
                </BulkBtn>
                <div className="relative">
                  <BulkBtn disabled={pending} onClick={() => setSnoozeMenu((v) => !v)}>
                    <Clock className="size-3.5" /> Odložit ▾
                  </BulkBtn>
                  {snoozeMenu && (
                    <div className="absolute right-0 top-9 z-20 flex flex-col gap-1 rounded-xl bg-cream p-1.5 text-ink-700 shadow-soft-md ring-1 ring-ink-900/10">
                      {SNOOZE_PRESETS.map((o) => (
                        <button
                          key={o.days}
                          type="button"
                          disabled={pending}
                          onClick={() => runBulk(() => bulkSnoozeTasks(ids(), o.days))}
                          className="whitespace-nowrap rounded-lg px-3 py-1.5 text-left text-sm font-semibold hover:bg-cream-warm"
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="relative">
                  <BulkBtn disabled={pending} onClick={() => setAssignMenu((v) => !v)}>
                    <UserPlus className="size-3.5" /> Přiřadit ▾
                  </BulkBtn>
                  {assignMenu && (
                    <div className="absolute right-0 top-9 z-20 flex max-h-64 w-52 flex-col gap-1 overflow-auto rounded-xl bg-cream p-1.5 text-ink-700 shadow-soft-md ring-1 ring-ink-900/10">
                      {members.map((m) => (
                        <button
                          key={m.userId}
                          type="button"
                          disabled={pending}
                          onClick={() => runBulk(() => bulkAssignTasks(ids(), m.userId))}
                          className="truncate rounded-lg px-3 py-1.5 text-left text-sm font-semibold hover:bg-cream-warm"
                        >
                          {m.label}
                        </button>
                      ))}
                      <div className="my-0.5 border-t border-ink-900/8" />
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => runBulk(() => bulkAssignTasks(ids(), null))}
                        className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-left text-sm font-semibold text-ink-500 hover:bg-cream-warm"
                      >
                        <UserMinus className="size-3.5" /> Zrušit přiřazení
                      </button>
                    </div>
                  )}
                </div>
                <BulkBtn
                  disabled={pending}
                  onClick={() => runBulk(() => bulkDismissTasks(ids()))}
                >
                  Zrušit úkoly
                </BulkBtn>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="inline-flex items-center gap-1 rounded-pill border border-cream/40 px-3 py-1.5 text-xs font-bold"
                >
                  <X className="size-3.5" /> Zrušit výběr
                </button>
              </div>
            </div>
          )}

          <TaskList
            tasks={filtered}
            showAnimal
            groupBy={groupBy}
            selectable={selectMode}
            selectedIds={selected}
            onToggleSelect={toggleSelect}
            emptyText="Žádné úkoly pro tento filtr. 🎉"
          />
        </>
      )}

      {view === "calendar" && <CalendarView week={week} tasks={filtered} />}
    </div>
  );
}

function CalendarView({ week, tasks }: { week: WeekLoadDay[]; tasks: TaskItem[] }) {
  const byDay = useMemo(() => {
    const m = new Map<string, TaskItem[]>();
    for (const t of tasks) {
      if (!t.due_date) continue;
      const key = t.due_date.slice(0, 10);
      const list = m.get(key) ?? [];
      list.push(t);
      m.set(key, list);
    }
    return m;
  }, [tasks]);

  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-7">
      {week.map((d) => {
        const items = byDay.get(d.date) ?? [];
        return (
          <div
            key={d.date}
            className={cn(
              "min-h-28 rounded-2xl border p-2",
              d.isToday ? "border-meadow-400 bg-meadow-50" : "border-ink-900/10 bg-cream",
            )}
          >
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[11px] font-bold text-ink-500">
                {d.label} {d.day}.
              </span>
              {items.length > 0 && (
                <span className="text-[11px] font-bold text-ink-400">{items.length}</span>
              )}
            </div>
            <ul className="space-y-1">
              {items.slice(0, 6).map((t) => (
                <li
                  key={t.id}
                  className={cn(
                    "truncate rounded-lg px-2 py-1 text-[11px] font-semibold",
                    t.priority === "high"
                      ? "bg-peach-100 text-terracotta-600"
                      : "bg-cream-warm text-ink-700",
                  )}
                  title={t.title}
                >
                  {t.title}
                </li>
              ))}
              {items.length > 6 && (
                <li className="px-2 text-[11px] font-bold text-ink-400">
                  +{items.length - 6} dalších
                </li>
              )}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function StatTile({
  n,
  label,
  tone,
  active,
  onClick,
}: {
  n: number;
  label: string;
  tone: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl p-4 text-left ring-1 ring-inset transition-shadow",
        tone,
        active && "ring-2 ring-ink-900/40",
      )}
    >
      <div className="font-display text-3xl font-bold leading-none">{n}</div>
      <div className="mt-1 text-xs font-bold text-ink-500">{label}</div>
    </button>
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

function BulkBtn({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-pill bg-cream px-3 py-1.5 text-xs font-bold text-ink-900 hover:bg-cream-warm disabled:opacity-50"
    >
      {children}
    </button>
  );
}
