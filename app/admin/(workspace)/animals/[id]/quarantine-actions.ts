"use server";

import { revalidatePath } from "next/cache";

import { requireMembership, ensurePermission } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { evalObservationFlag } from "@/lib/animal-quarantine";
import type { AnimalSupervisionStatus } from "@/types/database";
import { maybeAutoPublish } from "../actions";

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
  const __perm = await ensurePermission("health");
  if (!__perm.ok) return { error: __perm.error };
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
  /** Veterinární souhlas — povinný u izolace. */
  vet_consent?: boolean;
}

/**
 * Ukončí běžící epizodu dohledu (uvolnění do běžné části) a vrátí
 * `supervision_status` zvířete na „released". U izolace vyžaduje vet. souhlas.
 */
export async function endSupervision(
  animalId: string,
  recordId: string,
  input: EndSupervisionInput,
): Promise<ActionResult> {
  const __perm = await ensurePermission("health");
  if (!__perm.ok) return { error: __perm.error };
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();
  if (!(await assertOwned(service, animalId, institutionId))) {
    return { error: "Zvíře nepatří tvému útulku." };
  }

  // U izolace je k ukončení nutný veterinární souhlas.
  const { data: rec } = await service
    .from("quarantine_records")
    .select("kind")
    .eq("id", recordId)
    .eq("animal_id", animalId)
    .maybeSingle();
  if ((rec as { kind: string } | null)?.kind === "isolation" && !input.vet_consent) {
    return {
      error: "U izolace je k ukončení nutný veterinární souhlas.",
    };
  }

  const { error: updErr } = await service
    .from("quarantine_records")
    .update({
      ended_on: input.ended_on || new Date().toISOString().slice(0, 10),
      exam_results: blank(input.exam_results),
      vet_decision: blank(input.vet_decision),
      notes: blank(input.notes),
      vet_consent: input.vet_consent ?? false,
    })
    .eq("id", recordId)
    .eq("animal_id", animalId);
  if (updErr) return { error: updErr.message };

  const { error: animErr } = await service
    .from("animals")
    .update({ supervision_status: "released" })
    .eq("id", animalId);
  if (animErr) return { error: animErr.message };

  // Uzavřením karantény může zvíře splnit připravenost ke zveřejnění.
  await maybeAutoPublish(animalId, user.id);

  revalidate(animalId);
  return { ok: true };
}

/** Změní typ běžícího dohledu (karanténa ↔ izolace ↔ zdravotní dohled). */
export async function changeSupervisionType(
  animalId: string,
  recordId: string,
  kind: AnimalSupervisionStatus,
): Promise<ActionResult> {
  const __perm = await ensurePermission("health");
  if (!__perm.ok) return { error: __perm.error };
  const { institutionId } = await requireMembership();
  const service = createServiceClient();
  if (!(await assertOwned(service, animalId, institutionId))) {
    return { error: "Zvíře nepatří tvému útulku." };
  }
  if (kind === "released") return { error: "Neplatný typ dohledu." };

  await service.from("quarantine_records").update({ kind }).eq("id", recordId).eq("animal_id", animalId);
  await service.from("animals").update({ supervision_status: kind }).eq("id", animalId);
  revalidate(animalId);
  return { ok: true };
}

// ---- Denní pozorování -----------------------------------------------------

export interface ObservationInput {
  note: string;
  temperature: number | null;
  tags: string[];
}

export async function addObservation(
  animalId: string,
  input: ObservationInput,
): Promise<ActionResult> {
  const __perm = await ensurePermission("health");
  if (!__perm.ok) return { error: __perm.error };
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();
  if (!(await assertOwned(service, animalId, institutionId))) {
    return { error: "Zvíře nepatří tvému útulku." };
  }

  // Najdi běžící epizodu (volitelná vazba).
  const { data: active } = await service
    .from("quarantine_records")
    .select("id")
    .eq("animal_id", animalId)
    .is("ended_on", null)
    .order("started_on", { ascending: false })
    .limit(1)
    .maybeSingle();

  const flag = evalObservationFlag(input.tags, input.temperature);

  const { error } = await service.from("quarantine_observations").insert({
    animal_id: animalId,
    quarantine_id: (active as { id: string } | null)?.id ?? null,
    observed_at: new Date().toISOString(),
    created_by: user.id,
    note: blank(input.note),
    temperature: input.temperature,
    tags: input.tags.length > 0 ? input.tags : null,
    flag,
  });
  if (error) return { error: error.message };

  revalidate(animalId);
  return { ok: true };
}

// ---- Sledování expozice (kontakty) ----------------------------------------

export async function addContact(
  animalId: string,
  contactAnimalId: string,
  reason: string,
): Promise<ActionResult> {
  const __perm = await ensurePermission("health");
  if (!__perm.ok) return { error: __perm.error };
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();
  if (!(await assertOwned(service, animalId, institutionId))) {
    return { error: "Zvíře nepatří tvému útulku." };
  }
  if (!contactAnimalId) return { error: "Vyber zvíře v kontaktu." };
  // Kontaktní zvíře musí patřit témuž útulku.
  if (!(await assertOwned(service, contactAnimalId, institutionId))) {
    return { error: "Kontaktní zvíře nepatří tvému útulku." };
  }

  const { error } = await service.from("quarantine_contacts").insert({
    animal_id: animalId,
    contact_animal_id: contactAnimalId,
    reason: blank(reason),
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidate(animalId);
  return { ok: true };
}

export async function deleteContact(
  animalId: string,
  contactId: string,
): Promise<ActionResult> {
  const __perm = await ensurePermission("health");
  if (!__perm.ok) return { error: __perm.error };
  const { institutionId } = await requireMembership();
  const service = createServiceClient();
  if (!(await assertOwned(service, animalId, institutionId))) {
    return { error: "Zvíře nepatří tvému útulku." };
  }
  const { error } = await service
    .from("quarantine_contacts")
    .delete()
    .eq("id", contactId)
    .eq("animal_id", animalId);
  if (error) return { error: error.message };
  revalidate(animalId);
  return { ok: true };
}

export async function deleteSupervisionRecord(
  animalId: string,
  recordId: string,
): Promise<ActionResult> {
  const __perm = await ensurePermission("health");
  if (!__perm.ok) return { error: __perm.error };
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
