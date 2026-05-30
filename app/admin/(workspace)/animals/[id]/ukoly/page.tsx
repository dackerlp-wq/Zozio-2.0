import { notFound } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AnimalTaskRow } from "@/types/database";

import { TaskList, type TaskItem } from "../../task-list";
import {
  ScheduleSection,
  TaskCreateBar,
  type ScheduleItem,
} from "../../schedule-list";

export const metadata = { title: "Úkoly — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AnimalTasksPage({ params }: PageProps) {
  const { id } = await params;
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const { data: owned } = await supabase
    .from("animals")
    .select("id")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!owned) notFound();

  const [{ data }, { data: scheduleRows }] = await Promise.all([
    supabase
      .from("animal_tasks")
      .select("*")
      .eq("animal_id", id)
      .order("status", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false }),
    supabase
      .from("task_schedules")
      .select(
        "id, type, priority, title, description, freq, interval, next_run, end_date, lead_days, active, animal_id",
      )
      .eq("animal_id", id)
      .order("next_run", { ascending: true }),
  ]);

  const rows = (data ?? []) as AnimalTaskRow[];
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
    animal_name: null,
  }));

  const scheduleData = (scheduleRows ?? []) as unknown as Array<{
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
  }>;
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
    animal_name: null,
  }));

  const open = tasks.filter((t) => t.status === "open");
  const closed = tasks.filter((t) => t.status !== "open");

  return (
    <div className="space-y-6">
      <TaskCreateBar animalId={id} />

      <div className="space-y-2">
        <h2 className="font-display text-lg font-bold text-ink-900">
          Aktivní {open.length > 0 && <span className="text-ink-400">{open.length}</span>}
        </h2>
        <TaskList tasks={open} groupByDue emptyText="Žádné aktivní úkoly." />
      </div>

      {closed.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-display text-lg font-bold text-ink-900">
            Vyřízené
          </h2>
          <TaskList tasks={closed} />
        </div>
      )}

      <ScheduleSection schedules={schedules} />
    </div>
  );
}
