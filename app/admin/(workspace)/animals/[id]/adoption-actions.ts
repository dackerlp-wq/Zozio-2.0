"use server";

import { revalidatePath } from "next/cache";

import { requireMembership, ensurePermission } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import {
  blockerMessage,
  blockers,
  evaluateReadiness,
  READINESS_SELECT,
  type ReadinessGate,
  type ReadinessInput,
} from "@/lib/animal-readiness";
import type {
  AdoptionStatus,
  AnimalExitType,
  AnimalLegalStatus,
  MemberRole,
} from "@/types/database";

type ActionResult = { error: string } | { ok: true };

type OwnedAnimal = ReadinessInput & {
  legal_status: string;
  adoption_status: AdoptionStatus;
};

/**
 * Vyhodnotí readiness gate. Vrátí auditní poznámku o přebití (nebo null),
 * nebo error, pokud krok není dovolen.
 */
function checkGate(
  animal: OwnedAnimal,
  gate: ReadinessGate,
  role: MemberRole,
  override: string | undefined,
  what: string,
): { error: string } | { overrideNote: string | null } {
  const hard = blockers(evaluateReadiness(animal), gate);
  if (hard.length === 0) return { overrideNote: null };

  const reason = override?.trim() || null;
  const canOverride = role === "owner" || role === "admin";
  if (!reason) {
    return {
      error: canOverride
        ? `Zvíře není připravené (${what}): ${blockerMessage(hard)}. Pro přebití doplň důvod.`
        : `${what} nelze provést: ${blockerMessage(hard)}. Přebití může provést jen majitel nebo admin.`,
    };
  }
  if (!canOverride) {
    return { error: "Přebití blokace může provést jen majitel nebo admin." };
  }
  return {
    overrideNote: `[PŘEBITÍ připravenosti] ${blockerMessage(hard)} — důvod: ${reason}`,
  };
}

function blank(v: string): string | null {
  const t = v.trim();
  return t.length > 0 ? t : null;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

async function assertOwned(
  service: ReturnType<typeof createServiceClient>,
  animalId: string,
  institutionId: string,
): Promise<OwnedAnimal | null> {
  const { data } = await service
    .from("animals")
    .select(`id, adoption_status, ${READINESS_SELECT}`)
    .eq("id", animalId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  return (data as unknown as OwnedAnimal | null) ?? null;
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
  // Provázání os: uzavřením trvalé adopce přechází vlastnictví pryč z útulku.
  const patch: {
    adoption_status: AdoptionStatus;
    legal_status?: AnimalLegalStatus;
  } = {
    adoption_status: to,
  };
  if (to === "adopted") patch.legal_status = "transferred_out";
  await service.from("animals").update(patch).eq("id", animalId);
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
  override?: string,
): Promise<ActionResult> {
  const __perm = await ensurePermission("applications_screen");
  if (!__perm.ok) return { error: __perm.error };
  const { institutionId, user, role } = await requireMembership();
  const service = createServiceClient();
  const animal = await assertOwned(service, animalId, institutionId);
  if (!animal) return { error: "Zvíře nepatří tvému útulku." };
  if (!input.adopter_name.trim()) return { error: "Vyplň jméno adoptanta." };
  // Tvrdé oddělení: v ochranné lhůtě nelze zahájit adopci v žádné podobě
  // (ani zkušební dobu). Povolená je jen dočasná péče (záložka Pěstoun).
  if (animal.legal_status === "in_protection") {
    return {
      error:
        "Zvíře je v ochranné lhůtě — nelze zahájit adopci ani zkušební dobu. Počkej na konec lhůty (převod do vlastnictví útulku), nebo zvíře dej do dočasné péče.",
    };
  }

  // Readiness gate: zahájení adopce (příp. rovnou uzavření) vyžaduje vyřízený
  // příjem, uzavřenou karanténu a identifikaci.
  const gate = checkGate(
    animal,
    input.finalize_immediately ? "adopt_finalize" : "adopt_start",
    role,
    override,
    input.finalize_immediately ? "uzavření adopce" : "zahájení adopce",
  );
  if ("error" in gate) return gate;

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
    [
      finalize ? "Trvalá adopce uzavřena" : "Zahájena zkušební doba adopce",
      gate.overrideNote,
    ]
      .filter(Boolean)
      .join(" · "),
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
  override?: string,
): Promise<ActionResult> {
  const __perm = await ensurePermission("applications_screen");
  if (!__perm.ok) return { error: __perm.error };
  const { institutionId, user, role } = await requireMembership();
  const service = createServiceClient();
  const animal = await assertOwned(service, animalId, institutionId);
  if (!animal) return { error: "Zvíře nepatří tvému útulku." };
  if (animal.legal_status === "in_protection") {
    return {
      error:
        "Zvíře je v ochranné lhůtě — nelze uzavřít trvalou adopci. Nejprve ho převeď do vlastnictví útulku.",
    };
  }

  const gate = checkGate(
    animal,
    "adopt_finalize",
    role,
    override,
    "uzavření adopce",
  );
  if ("error" in gate) return gate;

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
    ["Trvalá adopce uzavřena", gate.overrideNote].filter(Boolean).join(" · "),
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
  const __perm = await ensurePermission("applications_screen");
  if (!__perm.ok) return { error: __perm.error };
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
  const __perm = await ensurePermission("applications_screen");
  if (!__perm.ok) return { error: __perm.error };
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
  const __perm = await ensurePermission("applications_screen");
  if (!__perm.ok) return { error: __perm.error };
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
  const __perm = await ensurePermission("applications_screen");
  if (!__perm.ok) return { error: __perm.error };
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

// --- Sledování zkušebky / kontrola po adopci -------------------------------

export interface AdoptionCheckinInput {
  kind: "trial" | "post_adoption";
  method: "phone" | "visit" | "message";
  note: string;
  photos?: string[];
}

export async function addAdoptionCheckin(
  animalId: string,
  adoptionId: string,
  input: AdoptionCheckinInput,
): Promise<ActionResult> {
  const __perm = await ensurePermission("applications_screen");
  if (!__perm.ok) return { error: __perm.error };
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();
  const animal = await assertOwned(service, animalId, institutionId);
  if (!animal) return { error: "Zvíře nepatří tvému útulku." };

  const { error } = await service.from("adoption_checkins").insert({
    adoption_id: adoptionId,
    animal_id: animalId,
    kind: input.kind,
    checked_on: todayStr(),
    method: input.method,
    note: blank(input.note),
    photos: input.photos && input.photos.length > 0 ? input.photos : null,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidate(animalId);
  return { ok: true };
}

// --- Komunikace s adoptantem -----------------------------------------------

export async function addAdoptionCommunication(
  animalId: string,
  adoptionId: string,
  kind: "call" | "message" | "email",
  note: string,
): Promise<ActionResult> {
  const __perm = await ensurePermission("applications_screen");
  if (!__perm.ok) return { error: __perm.error };
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();
  const animal = await assertOwned(service, animalId, institutionId);
  if (!animal) return { error: "Zvíře nepatří tvému útulku." };
  if (!blank(note)) return { error: "Vyplň text komunikace." };

  const { error } = await service.from("adoption_communications").insert({
    adoption_id: adoptionId,
    animal_id: animalId,
    kind,
    note: blank(note),
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidate(animalId);
  return { ok: true };
}

// --- Adopční poplatek: označit zaplaceno -----------------------------------

export async function setAdoptionFeePaid(
  animalId: string,
  adoptionId: string,
  paid: boolean,
): Promise<ActionResult> {
  const __perm = await ensurePermission("applications_screen");
  if (!__perm.ok) return { error: __perm.error };
  const { institutionId } = await requireMembership();
  const service = createServiceClient();
  const animal = await assertOwned(service, animalId, institutionId);
  if (!animal) return { error: "Zvíře nepatří tvému útulku." };

  const { error } = await service
    .from("adoptions")
    .update({ fee_paid_at: paid ? new Date().toISOString() : null })
    .eq("id", adoptionId)
    .eq("animal_id", animalId);
  if (error) return { error: error.message };

  revalidate(animalId);
  return { ok: true };
}
