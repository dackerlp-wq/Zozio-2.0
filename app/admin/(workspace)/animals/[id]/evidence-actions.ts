"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type {
  AnimalCostCategory,
  AnimalIncidentType,
} from "@/types/database";

type ActionResult = { error: string } | { ok: true };

function blank(v: string): string | null {
  const t = v.trim();
  return t.length > 0 ? t : null;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

async function assertOwned(
  service: ReturnType<typeof createServiceClient>,
  animalId: string,
  institutionId: string,
): Promise<boolean> {
  const { data } = await service
    .from("animals")
    .select("id")
    .eq("id", animalId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  return !!data;
}

function revalidate(animalId: string) {
  revalidatePath(`/admin/animals/${animalId}/evidence`);
  revalidatePath(`/admin/animals/${animalId}`);
}

// ---- Náklady ---------------------------------------------------------------

export interface CostInput {
  category: AnimalCostCategory;
  amount: number;
  spent_on: string;
  description: string;
  invoice_url: string;
}

export async function addCost(
  animalId: string,
  input: CostInput,
): Promise<ActionResult> {
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();
  if (!(await assertOwned(service, animalId, institutionId))) {
    return { error: "Zvíře nepatří tvému útulku." };
  }
  if (!input.amount || input.amount <= 0) {
    return { error: "Zadej částku větší než nula." };
  }

  const { error } = await service.from("animal_costs").insert({
    animal_id: animalId,
    institution_id: institutionId,
    category: input.category,
    amount: input.amount,
    spent_on: input.spent_on || todayStr(),
    description: blank(input.description),
    invoice_url: blank(input.invoice_url),
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidate(animalId);
  return { ok: true };
}

export async function deleteCost(
  animalId: string,
  costId: string,
): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();
  if (!(await assertOwned(service, animalId, institutionId))) {
    return { error: "Zvíře nepatří tvému útulku." };
  }

  const { error } = await service
    .from("animal_costs")
    .delete()
    .eq("id", costId)
    .eq("animal_id", animalId);
  if (error) return { error: error.message };

  revalidate(animalId);
  return { ok: true };
}

// ---- Incidenty (úniky atd.) ------------------------------------------------

export interface IncidentInput {
  kind: AnimalIncidentType;
  occurred_on: string;
  resolved_on: string;
  location: string;
  description: string;
  resolution: string;
  reported_to: string;
}

export async function addIncident(
  animalId: string,
  input: IncidentInput,
): Promise<ActionResult> {
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();
  if (!(await assertOwned(service, animalId, institutionId))) {
    return { error: "Zvíře nepatří tvému útulku." };
  }

  const { error } = await service.from("animal_incidents").insert({
    animal_id: animalId,
    institution_id: institutionId,
    kind: input.kind,
    occurred_on: input.occurred_on || todayStr(),
    resolved_on: blank(input.resolved_on),
    location: blank(input.location),
    description: blank(input.description),
    resolution: blank(input.resolution),
    reported_to: blank(input.reported_to),
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidate(animalId);
  return { ok: true };
}

export interface ResolveIncidentInput {
  resolved_on: string;
  resolution: string;
}

export async function resolveIncident(
  animalId: string,
  incidentId: string,
  input: ResolveIncidentInput,
): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();
  if (!(await assertOwned(service, animalId, institutionId))) {
    return { error: "Zvíře nepatří tvému útulku." };
  }

  const { error } = await service
    .from("animal_incidents")
    .update({
      resolved_on: input.resolved_on || todayStr(),
      resolution: blank(input.resolution),
    })
    .eq("id", incidentId)
    .eq("animal_id", animalId);
  if (error) return { error: error.message };

  revalidate(animalId);
  return { ok: true };
}

export async function deleteIncident(
  animalId: string,
  incidentId: string,
): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();
  if (!(await assertOwned(service, animalId, institutionId))) {
    return { error: "Zvíře nepatří tvému útulku." };
  }

  const { error } = await service
    .from("animal_incidents")
    .delete()
    .eq("id", incidentId)
    .eq("animal_id", animalId);
  if (error) return { error: error.message };

  revalidate(animalId);
  return { ok: true };
}
