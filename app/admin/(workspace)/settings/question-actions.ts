"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { ApplicationQuestionType } from "@/types/database";

type Result = { ok: true } | { error: string };

export interface QuestionInput {
  label: string;
  field_type: ApplicationQuestionType;
  options: string[];
  required: boolean;
  species: string[];
}

async function guard() {
  const m = await requireMembership();
  if (m.role !== "owner" && m.role !== "admin") {
    return { error: "Jen vlastník nebo správce může upravovat otázky." as const };
  }
  return { ok: true as const, institutionId: m.institutionId };
}

export async function addApplicationQuestion(input: QuestionInput): Promise<Result> {
  const g = await guard();
  if ("error" in g) return g;
  if (!input.label.trim()) return { error: "Zadej znění otázky." };

  const service = createServiceClient();
  const { data: max } = await service
    .from("application_questions")
    .select("sort_order")
    .eq("institution_id", g.institutionId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((max as { sort_order: number } | null)?.sort_order ?? 0) + 1;

  const { error } = await service.from("application_questions").insert({
    institution_id: g.institutionId,
    label: input.label.trim(),
    field_type: input.field_type,
    options: input.field_type === "select" ? input.options.filter((o) => o.trim()) : [],
    required: input.required,
    species: input.species,
    sort_order: nextOrder,
    active: true,
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function toggleApplicationQuestion(id: string, active: boolean): Promise<Result> {
  const g = await guard();
  if ("error" in g) return g;
  const service = createServiceClient();
  const { error } = await service
    .from("application_questions")
    .update({ active })
    .eq("id", id)
    .eq("institution_id", g.institutionId);
  if (error) return { error: error.message };
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function deleteApplicationQuestion(id: string): Promise<Result> {
  const g = await guard();
  if ("error" in g) return g;
  const service = createServiceClient();
  const { error } = await service
    .from("application_questions")
    .delete()
    .eq("id", id)
    .eq("institution_id", g.institutionId);
  if (error) return { error: error.message };
  revalidatePath("/admin/settings");
  return { ok: true };
}
