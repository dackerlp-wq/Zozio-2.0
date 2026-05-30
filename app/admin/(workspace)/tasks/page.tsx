import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import {
  AddTaskForm,
  TaskList,
  type TaskItem,
} from "../animals/task-list";

export const metadata = { title: "Úkoly — Zozio Admin" };

interface TaskRow {
  id: string;
  type: TaskItem["type"];
  title: string;
  description: string | null;
  due_date: string | null;
  status: TaskItem["status"];
  source: "manual" | "auto";
  animal_id: string | null;
  animals: { name: string } | null;
}

export default async function TasksInboxPage() {
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const { data } = await supabase
    .from("animal_tasks")
    .select(
      "id, type, title, description, due_date, status, source, animal_id, animals(name)",
    )
    .eq("institution_id", institutionId)
    .order("due_date", { ascending: true, nullsFirst: false })
    .limit(500);

  const rows = (data ?? []) as unknown as TaskRow[];
  const tasks: TaskItem[] = rows.map((t) => ({
    id: t.id,
    type: t.type,
    title: t.title,
    description: t.description,
    due_date: t.due_date,
    status: t.status,
    source: t.source,
    animal_id: t.animal_id,
    animal_name: t.animals?.name ?? null,
  }));

  const open = tasks.filter((t) => t.status === "open");
  const closed = tasks.filter((t) => t.status !== "open");

  const todayStr = new Date().toISOString().slice(0, 10);
  const overdue = open.filter((t) => t.due_date && t.due_date < todayStr).length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
          Úkoly
        </h2>
        <p className="mt-1 text-ink-600">
          {open.length} aktivních
          {overdue > 0 && (
            <span className="font-semibold text-terracotta-600">
              {" "}
              · {overdue} po termínu
            </span>
          )}
        </p>
      </div>

      <AddTaskForm animalId={null} />

      <TaskList
        tasks={open}
        showAnimal
        emptyText="Žádné aktivní úkoly. 🎉"
      />

      {closed.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-display text-lg font-bold text-ink-900">
            Vyřízené
          </h3>
          <TaskList tasks={closed} showAnimal />
        </div>
      )}
    </div>
  );
}
