"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { AdoptionStatus, AnimalExitType } from "@/types/database";

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
): Promise<{ legal_status: string; adoption_status: AdoptionStatus } | null> {
  const { data } = await service
    .from("animals")
    .select("id, legal_status, adoption_status")
    .eq("id", animalId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  return (
    (data as
      | { legal_status: string; adoption_status: AdoptionStatus }
      | null) ?? null
  );
}

function revalidate(animalId: string) {
  revalidatePath(`/admin/animals/${animalId}/adopce`);
  revalidatePath(`/admin/animals/${animalId}`);
  revalidatePath("/admin/animals");
}

/** Změní stav zvířete + zapíše audit, pokud se stav skutečně mění. */
async function setStatus(
  service: ReturnType<typeof createServiceClient>,
  animalId: string,
  from: AdoptionStatus,
  to: AdoptionStatus,
  note: string,
  userId: string,
) {
  if (from === to) return;
  await service
    .from("animals")
    .update({ adoption_status: to })
    .eq("id", animalId);
  await service.from("animal_status_events").insert({
    animal_id: animalId,
    from_status: from,
    to_status: to,
    note,
    changed_by: userId,
  });
}

export interface StartAdoptionInput {
  application_id: string | null;
  adopter_name: string;
  adopter_email: string;
  adopter_phone: string;
  adopter_address: string;
  adopter_id_number: string;
  started_on: string;
  trial_until: string;
  fee: number | null;
  contract_signed_at: string;
  contract_url: string;
  notes: string;
  /** Uzavřít rovnou jako trvalou adopci (útulky bez zkušební doby). */
  finalize_immediately: boolean;
}

export async function startAdoption(
  animalId: string,
  input: StartAdoptionInput,
): Promise<ActionResult> {
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();
  const animal = await assertOwned(service, animalId, institutionId);
  if (!animal) return { error: "Zvíře nepatří tvému útulku." };
  if (!input.adopter_name.trim()) return { error: "Vyplň jméno adoptanta." };
  if (input.finalize_immediately && animal.legal_status === "in_protection") {
    return {
      error:
        "Zvíře je v ochranné lhůtě — nelze uzavřít trvalou adopci. Můžeš zahájit zkušební dobu nebo počkat na konec lhůty.",
    };
  }

  // Pojistka: žádná běžící adopce.
  const { count } = await service
    .from("adoptions")
    .select("id", { count: "exact", head: true })
    .eq("animal_id", animalId)
    .eq("stage", "trial");
  if ((count ?? 0) > 0) {
    return { error: "Zvíře už má rozjetou adopci. Nejprve ji uzavři nebo zruš." };
  }

  const startedOn = input.started_on || todayStr();
  const finalize = input.finalize_immediately;

  const { error: insErr } = await service.from("adoptions").insert({
    animal_id: animalId,
    institution_id: institutionId,
    application_id: input.application_id,
    adopter_name: input.adopter_name.trim(),
    adopter_email: blank(input.adopter_email),
    adopter_phone: blank(input.adopter_phone),
    adopter_address: blank(input.adopter_address),
    adopter_id_number: blank(input.adopter_id_number),
    stage: finalize ? "finalized" : "trial",
    started_on: startedOn,
    trial_until: finalize ? null : blank(input.trial_until),
    finalized_on: finalize ? startedOn : null,
    fee: input.fee,
    contract_signed_at: blank(input.contract_signed_at),
    contract_url: blank(input.contract_url),
    notes: blank(input.notes),
    created_by: user.id,
  });
  if (insErr) return { error: insErr.message };

  await setStatus(
    service,
    animalId,
    animal.adoption_status,
    finalize ? "adopted" : "reserved",
    finalize ? "Trvalá adopce uzavřena" : "Zahájena zkušební doba adopce",
    user.id,
  );

  revalidate(animalId);
  return { ok: true };
}

export interface FinalizeAdoptionInput {
  finalized_on: string;
  fee: number | null;
  contract_signed_at: string;
  contract_url: string;
}

export async function finalizeAdoption(
  animalId: string,
  adoptionId: string,
  input: FinalizeAdoptionInput,
): Promise<ActionResult> {
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();
  const animal = await assertOwned(service, animalId, institutionId);
  if (!animal) return { error: "Zvíře nepatří tvému útulku." };
  if (animal.legal_status === "in_protection") {
    return {
      error:
        "Zvíře je v ochranné lhůtě — nelze uzavřít trvalou adopci. Nejprve ho převeď do vlastnictví útulku.",
    };
  }

  const { data: existing } = await service
    .from("adoptions")
    .select("id, fee, contract_signed_at, contract_url")
    .eq("id", adoptionId)
    .eq("animal_id", animalId)
    .eq("stage", "trial")
    .maybeSingle();
  if (!existing) return { error: "Běžící adopci se nepodařilo najít." };
  const prev = existing as {
    fee: number | null;
    contract_signed_at: string | null;
    contract_url: string | null;
  };

  const { error: updErr } = await service
    .from("adoptions")
    .update({
      stage: "finalized",
      finalized_on: input.finalized_on || todayStr(),
      fee: input.fee ?? prev.fee,
      contract_signed_at:
        blank(input.contract_signed_at) ?? prev.contract_signed_at,
      contract_url: blank(input.contract_url) ?? prev.contract_url,
    })
    .eq("id", adoptionId)
    .eq("animal_id", animalId);
  if (updErr) return { error: updErr.message };

  await setStatus(
    service,
    animalId,
    animal.adoption_status,
    "adopted",
    "Trvalá adopce uzavřena",
    user.id,
  );

  revalidate(animalId);
  return { ok: true };
}

export interface CancelAdoptionInput {
  cancelled_on: string;
  cancel_reason: string;
  /** Stav, do kterého se zvíře vrátí. */
  return_status: "available" | "returned" | "intake";
  /** Založit i strukturovaný záznam o vrácení. */
  record_return: boolean;
}

export async function cancelAdoption(
  animalId: string,
  adoptionId: string,
  input: CancelAdoptionInput,
): Promise<ActionResult> {
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();
  const animal = await assertOwned(service, animalId, institutionId);
  if (!animal) return { error: "Zvíře nepatří tvému útulku." };

  const cancelledOn = input.cancelled_on || todayStr();

  const { error: updErr } = await service
    .from("adoptions")
    .update({
      stage: "cancelled",
      cancelled_on: cancelledOn,
      cancel_reason: blank(input.cancel_reason),
    })
    .eq("id", adoptionId)
    .eq("animal_id", animalId);
  if (updErr) return { error: updErr.message };

  if (input.record_return) {
    await service.from("animal_exit_records").insert({
      animal_id: animalId,
      institution_id: institutionId,
      kind: "return",
      occurred_on: cancelledOn,
      reason: blank(input.cancel_reason),
      adoption_id: adoptionId,
      created_by: user.id,
    });
  }

  await setStatus(
    service,
    animalId,
    animal.adoption_status,
    input.return_status,
    "Adopce zrušena — zvíře zpět v útulku",
    user.id,
  );

  revalidate(animalId);
  return { ok: true };
}

export async function deleteAdoption(
  animalId: string,
  adoptionId: string,
): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();
  const animal = await assertOwned(service, animalId, institutionId);
  if (!animal) return { error: "Zvíře nepatří tvému útulku." };

  const { error } = await service
    .from("adoptions")
    .delete()
    .eq("id", adoptionId)
    .eq("animal_id", animalId);
  if (error) return { error: error.message };

  revalidate(animalId);
  return { ok: true };
}

export interface ExitRecordInput {
  kind: AnimalExitType;
  occurred_on: string;
  reason: string;
  details: string;
  vet: string;
}

export async function recordExit(
  animalId: string,
  input: ExitRecordInput,
): Promise<ActionResult> {
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();
  const animal = await assertOwned(service, animalId, institutionId);
  if (!animal) return { error: "Zvíře nepatří tvému útulku." };

  const { error: insErr } = await service.from("animal_exit_records").insert({
    animal_id: animalId,
    institution_id: institutionId,
    kind: input.kind,
    occurred_on: input.occurred_on || todayStr(),
    reason: blank(input.reason),
    details: blank(input.details),
    vet: blank(input.vet),
    created_by: user.id,
  });
  if (insErr) return { error: insErr.message };

  const to: AdoptionStatus = input.kind === "return" ? "returned" : "deceased";
  const note =
    input.kind === "return"
      ? "Zvíře vráceno do útulku"
      : input.kind === "euthanasia"
        ? "Zvíře utraceno"
        : "Úhyn zvířete";
  await setStatus(service, animalId, animal.adoption_status, to, note, user.id);

  revalidate(animalId);
  return { ok: true };
}

export async function deleteExitRecord(
  animalId: string,
  recordId: string,
): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();
  const animal = await assertOwned(service, animalId, institutionId);
  if (!animal) return { error: "Zvíře nepatří tvému útulku." };

  const { error } = await service
    .from("animal_exit_records")
    .delete()
    .eq("id", recordId)
    .eq("animal_id", animalId);
  if (error) return { error: error.message };

  revalidate(animalId);
  return { ok: true };
}
