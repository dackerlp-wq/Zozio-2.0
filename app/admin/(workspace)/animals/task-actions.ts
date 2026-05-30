"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { AnimalTaskType } from "@/types/database";

type ActionResult = { error: string } | { ok: true };

export interface ManualTaskInput {
  animalId: string | null;
  type: AnimalTaskType;
  title: string;
  description: string;
  due_date: string;
}

function revalidateTasks(animalId: string | null) {
  revalidatePath("/admin/tasks");
  if (animalId) revalidatePath(`/admin/animals/${animalId}/ukoly`);
}

export async function createManualTask(
  input: ManualTaskInput,
): Promise<ActionResult> {
  const { institutionId, user } = await requireMembership();
  if (!input.title.trim()) return { error: "Zadej název úkolu." };

  const service = createServiceClient();

  // Když je úkol vázaný na zvíře, ověř že patří útulku.
  if (input.animalId) {
    const { data } = await service
      .from("animals")
      .select("id")
      .eq("id", input.animalId)
      .eq("institution_id", institutionId)
      .maybeSingle();
    if (!data) return { error: "Zvíře nepatří tvému útulku." };
  }

  const { error } = await service.from("animal_tasks").insert({
    institution_id: institutionId,
    animal_id: input.animalId,
    type: input.type,
    title: input.title.trim(),
    description: input.description.trim() || null,
    due_date: input.due_date || null,
    status: "open",
    source: "manual",
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidateTasks(input.animalId);
  return { ok: true };
}

async function setStatus(
  taskId: string,
  status: "open" | "done" | "dismissed",
): Promise<ActionResult> {
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();

  const { data: task } = await service
    .from("animal_tasks")
    .select("id, animal_id")
    .eq("id", taskId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!task) return { error: "Úkol nenalezen." };

  const patch =
    status === "done"
      ? { status, completed_at: new Date().toISOString(), completed_by: user.id }
      : { status, completed_at: null, completed_by: null };

  const { error } = await service
    .from("animal_tasks")
    .update(patch)
    .eq("id", taskId)
    .eq("institution_id", institutionId);
  if (error) return { error: error.message };

  revalidateTasks((task as { animal_id: string | null }).animal_id);
  return { ok: true };
}

export async function completeTask(taskId: string) {
  return setStatus(taskId, "done");
}

export async function reopenTask(taskId: string) {
  return setStatus(taskId, "open");
}

export async function dismissTask(taskId: string) {
  return setStatus(taskId, "dismissed");
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();

  const { data: task } = await service
    .from("animal_tasks")
    .select("id, animal_id")
    .eq("id", taskId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!task) return { error: "Úkol nenalezen." };

  const { error } = await service
    .from("animal_tasks")
    .delete()
    .eq("id", taskId)
    .eq("institution_id", institutionId);
  if (error) return { error: error.message };

  revalidateTasks((task as { animal_id: string | null }).animal_id);
  return { ok: true };
}
