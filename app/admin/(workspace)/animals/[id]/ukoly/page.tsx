import { notFound } from "next/navigation";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AnimalTaskRow } from "@/types/database";

import { AddTaskForm, TaskList, type TaskItem } from "../../task-list";

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

  const { data } = await supabase
    .from("animal_tasks")
    .select("*")
    .eq("animal_id", id)
    .order("status", { ascending: true })
    .order("due_date", { ascending: true, nullsFirst: false });

  const rows = (data ?? []) as AnimalTaskRow[];
  const tasks: TaskItem[] = rows.map((t) => ({
    id: t.id,
    type: t.type,
    title: t.title,
    description: t.description,
    due_date: t.due_date,
    status: t.status,
    source: t.source,
    animal_id: t.animal_id,
    animal_name: null,
  }));

  const open = tasks.filter((t) => t.status === "open");
  const closed = tasks.filter((t) => t.status !== "open");

  return (
    <div className="space-y-6">
      <AddTaskForm animalId={id} />

      <div className="space-y-2">
        <h2 className="font-display text-lg font-bold text-ink-900">
          Aktivní {open.length > 0 && <span className="text-ink-400">{open.length}</span>}
        </h2>
        <TaskList tasks={open} emptyText="Žádné aktivní úkoly." />
      </div>

      {closed.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-display text-lg font-bold text-ink-900">
            Vyřízené
          </h2>
          <TaskList tasks={closed} />
        </div>
      )}
    </div>
  );
}
