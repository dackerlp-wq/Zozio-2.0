"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { firstRunFrom, todayISO } from "@/lib/task-schedule";
import type {
  AnimalTaskPriority,
  AnimalTaskType,
  TaskScheduleFreq,
} from "@/types/database";

type ActionResult = { error: string } | { ok: true };

export interface TaskScheduleInput {
  animalId: string | null;
  type: AnimalTaskType;
  priority: AnimalTaskPriority;
  title: string;
  description: string;
  freq: TaskScheduleFreq;
  interval: number;
  start_date: string;
  end_date: string;
  lead_days: number;
}

function revalidateSchedules(animalId: string | null) {
  revalidatePath("/admin/tasks");
  if (animalId) revalidatePath(`/admin/animals/${animalId}`);
}

function validate(input: TaskScheduleInput): string | null {
  if (!input.title.trim()) return "Zadej název úkolu.";
  if (!input.start_date) return "Zadej datum prvního výskytu.";
  if (!Number.isFinite(input.interval) || input.interval < 1)
    return "Interval musí být alespoň 1.";
  if (input.lead_days < 0) return "Předstih nemůže být záporný.";
  if (input.end_date && input.end_date < input.start_date)
    return "Konec opakování nemůže být před začátkem.";
  return null;
}

export async function createTaskSchedule(
  input: TaskScheduleInput,
): Promise<ActionResult> {
  const { institutionId, user } = await requireMembership();
  const err = validate(input);
  if (err) return { error: err };

  const service = createServiceClient();

  if (input.animalId) {
    const { data } = await service
      .from("animals")
      .select("id")
      .eq("id", input.animalId)
      .eq("institution_id", institutionId)
      .maybeSingle();
    if (!data) return { error: "Zvíře nepatří tvému útulku." };
  }

  const nextRun = firstRunFrom(
    input.start_date,
    input.freq,
    input.interval,
    todayISO(),
  );

  const { error } = await service.from("task_schedules").insert({
    institution_id: institutionId,
    animal_id: input.animalId,
    type: input.type,
    priority: input.priority,
    title: input.title.trim(),
    description: input.description.trim() || null,
    freq: input.freq,
    interval: Math.trunc(input.interval),
    start_date: input.start_date,
    end_date: input.end_date || null,
    lead_days: Math.trunc(input.lead_days),
    next_run: nextRun,
    active: true,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidateSchedules(input.animalId);
  return { ok: true };
}

async function ownedSchedule(
  service: ReturnType<typeof createServiceClient>,
  scheduleId: string,
  institutionId: string,
): Promise<{ animal_id: string | null } | null> {
  const { data } = await service
    .from("task_schedules")
    .select("animal_id")
    .eq("id", scheduleId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  return (data as { animal_id: string | null } | null) ?? null;
}

export async function setScheduleActive(
  scheduleId: string,
  active: boolean,
): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();

  const sched = await ownedSchedule(service, scheduleId, institutionId);
  if (!sched) return { error: "Šablona nenalezena." };

  const { error } = await service
    .from("task_schedules")
    .update({ active })
    .eq("id", scheduleId)
    .eq("institution_id", institutionId);
  if (error) return { error: error.message };

  revalidateSchedules(sched.animal_id);
  return { ok: true };
}

export async function deleteTaskSchedule(
  scheduleId: string,
): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();

  const sched = await ownedSchedule(service, scheduleId, institutionId);
  if (!sched) return { error: "Šablona nenalezena." };

  const { error } = await service
    .from("task_schedules")
    .delete()
    .eq("id", scheduleId)
    .eq("institution_id", institutionId);
  if (error) return { error: error.message };

  revalidateSchedules(sched.animal_id);
  return { ok: true };
}
