import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { TaskList, type TaskItem } from "../animals/task-list";
import {
  ScheduleSection,
  TaskCreateBar,
  type ScheduleItem,
} from "../animals/schedule-list";
import { TaskBoard } from "./task-board";

export const metadata = { title: "Úkoly — Zozio Admin" };

interface TaskRow {
  id: string;
  type: TaskItem["type"];
  priority: TaskItem["priority"];
  title: string;
  description: string | null;
  due_date: string | null;
  status: TaskItem["status"];
  source: "manual" | "auto";
  assigned_to: string | null;
  snoozed_until: string | null;
  animal_id: string | null;
  animals: { name: string } | null;
}

interface ScheduleRow {
  id: string;
  type: ScheduleItem["type"];
  priority: ScheduleItem["priority"];
  title: string;
  description: string | null;
  freq: ScheduleItem["freq"];
  interval: number;
  next_run: string;
  end_date: string | null;
  lead_days: number;
  active: boolean;
  animal_id: string | null;
  animals: { name: string } | null;
}

export default async function TasksInboxPage() {
  const { institutionId, user, role } = await requireMembership();
  const supabase = await createClient();
  const todayStr = new Date().toISOString().slice(0, 10);

  const [{ data }, { data: animalRows }, { data: scheduleRows }] =
    await Promise.all([
      supabase
        .from("animal_tasks")
        .select(
          "id, type, priority, title, description, due_date, status, source, assigned_to, snoozed_until, animal_id, animals(name)",
        )
        .eq("institution_id", institutionId)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(500),
      supabase
        .from("animals")
        .select("id, name")
        .eq("institution_id", institutionId)
        .order("name", { ascending: true }),
      supabase
        .from("task_schedules")
        .select(
          "id, type, priority, title, description, freq, interval, next_run, end_date, lead_days, active, animal_id, animals(name)",
        )
        .eq("institution_id", institutionId)
        .order("next_run", { ascending: true }),
    ]);

  const animalOptions = (animalRows ?? []) as { id: string; name: string }[];

  const rows = (data ?? []) as unknown as TaskRow[];
  const tasks: TaskItem[] = rows.map((t) => ({
    id: t.id,
    type: t.type,
    priority: t.priority,
    title: t.title,
    description: t.description,
    due_date: t.due_date,
    status: t.status,
    source: t.source,
    animal_id: t.animal_id,
    animal_name: t.animals?.name ?? null,
    assigned_to: t.assigned_to,
    assignee_name: t.assigned_to === user.id ? "já" : null,
  }));

  // Mapa snooze podle id (snoozed do budoucna → skrýt z aktivních).
  const snoozedFuture = new Set(
    rows.filter((t) => t.snoozed_until && t.snoozed_until > todayStr).map((t) => t.id),
  );

  const scheduleData = (scheduleRows ?? []) as unknown as ScheduleRow[];
  const schedules: ScheduleItem[] = scheduleData.map((s) => ({
    id: s.id,
    type: s.type,
    priority: s.priority,
    title: s.title,
    description: s.description,
    freq: s.freq,
    interval: s.interval,
    next_run: s.next_run,
    end_date: s.end_date,
    lead_days: s.lead_days,
    active: s.active,
    animal_id: s.animal_id,
    animal_name: s.animals?.name ?? null,
  }));

  // Aktivní = otevřené a ne-odložené (odložené se vrátí v cílový den).
  const open = tasks.filter((t) => t.status === "open" && !snoozedFuture.has(t.id));
  const closed = tasks.filter((t) => t.status !== "open");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
          Dnešní přehled
        </h2>
        <p className="mt-1 text-ink-600">
          Úkoly a připomínky ze všech zvířat na jednom místě.
        </p>
      </div>

      <TaskCreateBar animalId={null} animals={animalOptions} />

      <TaskBoard tasks={open} defaultMine={role === "staff"} />

      {closed.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-lg font-bold text-ink-900">
            Vyřízené
          </h3>
          <TaskList tasks={closed} showAnimal />
        </div>
      )}

      <ScheduleSection schedules={schedules} showAnimal />
    </div>
  );
}
