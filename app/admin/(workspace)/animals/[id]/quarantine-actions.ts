"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { AnimalSupervisionStatus } from "@/types/database";

type ActionResult = { error: string } | { ok: true };

function blank(v: string): string | null {
  const t = v.trim();
  return t.length > 0 ? t : null;
}

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
  revalidatePath(`/admin/animals/${animalId}/karantena`);
  revalidatePath(`/admin/animals/${animalId}`);
}

export interface StartSupervisionInput {
  kind: AnimalSupervisionStatus; // quarantine | isolation | monitored
  started_on: string;
  planned_until: string;
  reason: string;
}

/**
 * Založí novou epizodu dohledu (karanténa / izolace / sledování) a nastaví
 * aktuální `supervision_status` zvířete. Případnou běžící epizodu uzavře.
 */
export async function startSupervision(
  animalId: string,
  input: StartSupervisionInput,
): Promise<ActionResult> {
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();
  if (!(await assertOwned(service, animalId, institutionId))) {
    return { error: "Zvíře nepatří tvému útulku." };
  }
  if (input.kind === "released") {
    return { error: "Neplatný režim dohledu." };
  }

  const startedOn = input.started_on || new Date().toISOString().slice(0, 10);

  // Uzavři běžící epizody (ke dni začátku nové).
  await service
    .from("quarantine_records")
    .update({ ended_on: startedOn })
    .eq("animal_id", animalId)
    .is("ended_on", null);

  const { error: insErr } = await service.from("quarantine_records").insert({
    animal_id: animalId,
    institution_id: institutionId,
    kind: input.kind,
    started_on: startedOn,
    planned_until: blank(input.planned_until),
    reason: blank(input.reason),
    created_by: user.id,
  });
  if (insErr) return { error: insErr.message };

  const { error: updErr } = await service
    .from("animals")
    .update({ supervision_status: input.kind })
    .eq("id", animalId);
  if (updErr) return { error: updErr.message };

  revalidate(animalId);
  return { ok: true };
}

export interface EndSupervisionInput {
  ended_on: string;
  exam_results: string;
  vet_decision: string;
  notes: string;
}

/**
 * Ukončí běžící epizodu dohledu (uvolnění do běžné části) a vrátí
 * `supervision_status` zvířete na „released".
 */
export async function endSupervision(
  animalId: string,
  recordId: string,
  input: EndSupervisionInput,
): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();
  if (!(await assertOwned(service, animalId, institutionId))) {
    return { error: "Zvíře nepatří tvému útulku." };
  }

  const { error: updErr } = await service
    .from("quarantine_records")
    .update({
      ended_on: input.ended_on || new Date().toISOString().slice(0, 10),
      exam_results: blank(input.exam_results),
      vet_decision: blank(input.vet_decision),
      notes: blank(input.notes),
    })
    .eq("id", recordId)
    .eq("animal_id", animalId);
  if (updErr) return { error: updErr.message };

  const { error: animErr } = await service
    .from("animals")
    .update({ supervision_status: "released" })
    .eq("id", animalId);
  if (animErr) return { error: animErr.message };

  revalidate(animalId);
  return { ok: true };
}

export async function deleteSupervisionRecord(
  animalId: string,
  recordId: string,
): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();
  if (!(await assertOwned(service, animalId, institutionId))) {
    return { error: "Zvíře nepatří tvému útulku." };
  }

  // Byla to běžící epizoda? Pokud ano, vrať zvíře do běžné části.
  const { data: rec } = await service
    .from("quarantine_records")
    .select("ended_on")
    .eq("id", recordId)
    .eq("animal_id", animalId)
    .maybeSingle();

  const { error } = await service
    .from("quarantine_records")
    .delete()
    .eq("id", recordId)
    .eq("animal_id", animalId);
  if (error) return { error: error.message };

  if (rec && (rec as { ended_on: string | null }).ended_on === null) {
    await service
      .from("animals")
      .update({ supervision_status: "released" })
      .eq("id", animalId);
  }

  revalidate(animalId);
  return { ok: true };
}
