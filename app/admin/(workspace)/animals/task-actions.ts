"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { AnimalTaskPriority, AnimalTaskType } from "@/types/database";

type ActionResult = { error: string } | { ok: true };

export interface ManualTaskInput {
  animalId: string | null;
  type: AnimalTaskType;
  priority: AnimalTaskPriority;
  title: string;
  description: string;
  due_date: string;
}

function revalidateTasks(animalId: string | null) {
  revalidatePath("/admin/tasks");
  revalidatePath("/admin/dashboard");
  if (animalId) revalidatePath(`/admin/animals/${animalId}`);
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
    priority: input.priority,
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

/** Odloží úkol o `days` dní (snooze) — zůstává otevřený, do té doby skrytý. */
export async function snoozeTask(taskId: string, days: number): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();

  const { data: task } = await service
    .from("animal_tasks")
    .select("id, animal_id, snooze_count")
    .eq("id", taskId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!task) return { error: "Úkol nenalezen." };

  const until = new Date();
  until.setDate(until.getDate() + Math.max(1, Math.round(days)));
  const untilStr = until.toISOString().slice(0, 10);
  const prev = (task as { snooze_count: number | null }).snooze_count ?? 0;

  const { error } = await service
    .from("animal_tasks")
    .update({ snoozed_until: untilStr, status: "open", snooze_count: prev + 1 })
    .eq("id", taskId)
    .eq("institution_id", institutionId);
  if (error) return { error: error.message };

  revalidateTasks((task as { animal_id: string | null }).animal_id);
  return { ok: true };
}

export async function deleteTask(taskId: string): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();

  const { data: task } = await service
    .from("animal_tasks")
    .select("id, animal_id, source")
    .eq("id", taskId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!task) return { error: "Úkol nenalezen." };

  if ((task as { source: string | null }).source === "auto") {
    return { error: "Systémový úkol nelze smazat — jen ho odbav nebo odlož." };
  }

  const { error } = await service
    .from("animal_tasks")
    .delete()
    .eq("id", taskId)
    .eq("institution_id", institutionId);
  if (error) return { error: error.message };

  revalidateTasks((task as { animal_id: string | null }).animal_id);
  return { ok: true };
}

/* ── Hromadné akce (bulk) ─────────────────────────────────────────── */

export async function bulkCompleteTasks(taskIds: string[]): Promise<ActionResult> {
  const { institutionId, user } = await requireMembership();
  if (!taskIds.length) return { ok: true };
  const service = createServiceClient();

  const { error } = await service
    .from("animal_tasks")
    .update({
      status: "done",
      completed_at: new Date().toISOString(),
      completed_by: user.id,
    })
    .in("id", taskIds)
    .eq("institution_id", institutionId);
  if (error) return { error: error.message };

  revalidateTasks(null);
  return { ok: true };
}

export async function bulkSnoozeTasks(
  taskIds: string[],
  days: number,
): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  if (!taskIds.length) return { ok: true };
  const service = createServiceClient();

  const until = new Date();
  until.setDate(until.getDate() + Math.max(1, Math.round(days)));
  const untilStr = until.toISOString().slice(0, 10);

  // Načti aktuální počítadla, ať můžeme inkrementovat jednotlivě.
  const { data: rows } = await service
    .from("animal_tasks")
    .select("id, snooze_count")
    .in("id", taskIds)
    .eq("institution_id", institutionId);

  for (const row of (rows ?? []) as { id: string; snooze_count: number | null }[]) {
    await service
      .from("animal_tasks")
      .update({
        snoozed_until: untilStr,
        status: "open",
        snooze_count: (row.snooze_count ?? 0) + 1,
      })
      .eq("id", row.id)
      .eq("institution_id", institutionId);
  }

  revalidateTasks(null);
  return { ok: true };
}

/** Přiřadí úkoly uživateli (mně) nebo zruší přiřazení (`null`). */
export async function bulkAssignTasks(
  taskIds: string[],
  assignToMe: boolean,
): Promise<ActionResult> {
  const { institutionId, user } = await requireMembership();
  if (!taskIds.length) return { ok: true };
  const service = createServiceClient();

  const { error } = await service
    .from("animal_tasks")
    .update({ assigned_to: assignToMe ? user.id : null })
    .in("id", taskIds)
    .eq("institution_id", institutionId);
  if (error) return { error: error.message };

  revalidateTasks(null);
  return { ok: true };
}

export async function bulkDismissTasks(taskIds: string[]): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  if (!taskIds.length) return { ok: true };
  const service = createServiceClient();

  const { error } = await service
    .from("animal_tasks")
    .update({ status: "dismissed", completed_at: null, completed_by: null })
    .in("id", taskIds)
    .eq("institution_id", institutionId);
  if (error) return { error: error.message };

  revalidateTasks(null);
  return { ok: true };
}

/** Přepne ranní e-mailový souhrn úkolů pro celý útulek. */
export async function toggleTaskDigest(enabled: boolean): Promise<ActionResult> {
  const { institutionId, role } = await requireMembership();
  if (role !== "owner" && role !== "admin") {
    return { error: "Nastavení může měnit jen vedoucí." };
  }
  const service = createServiceClient();

  const { error } = await service
    .from("institutions")
    .update({ task_digest_enabled: enabled })
    .eq("id", institutionId);
  if (error) return { error: error.message };

  revalidatePath("/admin/tasks");
  return { ok: true };
}
