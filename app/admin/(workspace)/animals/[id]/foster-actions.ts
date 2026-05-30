"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import type { AdoptionStatus } from "@/types/database";

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
): Promise<{ legal_status: string } | null> {
  const { data } = await service
    .from("animals")
    .select("id, legal_status")
    .eq("id", animalId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  return (data as { legal_status: string } | null) ?? null;
}

function revalidate(animalId: string, carerId?: string) {
  revalidatePath(`/admin/animals/${animalId}/pestoun`);
  revalidatePath(`/admin/animals/${animalId}`);
  revalidatePath("/admin/foster");
  if (carerId) revalidatePath(`/admin/foster/${carerId}`);
}

export interface StartPlacementInput {
  carer_id: string;
  started_on: string;
  planned_until: string;
  fee: number | null;
  contract_signed_at: string;
  contract_url: string;
  notes: string;
}

/**
 * Předá zvíře do dočasné péče pěstounovi. Nastaví adoption_status na
 * „foster" a uzavře případné běžící umístění. Ochranná lhůta nevadí —
 * dočasná péče je během ní povolená.
 */
export async function startFosterPlacement(
  animalId: string,
  input: StartPlacementInput,
): Promise<ActionResult> {
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();
  const animal = await assertOwned(service, animalId, institutionId);
  if (!animal) return { error: "Zvíře nepatří tvému útulku." };
  if (!input.carer_id) return { error: "Vyber pěstouna." };

  const startedOn = input.started_on || todayStr();

  // Uzavři běžící umístění (ke dni začátku nového).
  await service
    .from("foster_placements")
    .update({ ended_on: startedOn, end_reason: "Nahrazeno novým umístěním" })
    .eq("animal_id", animalId)
    .is("ended_on", null);

  const { error: insErr } = await service.from("foster_placements").insert({
    animal_id: animalId,
    institution_id: institutionId,
    carer_id: input.carer_id,
    started_on: startedOn,
    planned_until: blank(input.planned_until),
    fee: input.fee,
    contract_signed_at: blank(input.contract_signed_at),
    contract_url: blank(input.contract_url),
    notes: blank(input.notes),
    created_by: user.id,
  });
  if (insErr) return { error: insErr.message };

  // Stav umístění → dočasná péče (+ audit do animal_status_events).
  const { data: cur } = await service
    .from("animals")
    .select("adoption_status")
    .eq("id", animalId)
    .maybeSingle();
  const fromStatus = (cur as { adoption_status: AdoptionStatus } | null)
    ?.adoption_status;

  if (fromStatus !== "foster") {
    await service
      .from("animals")
      .update({ adoption_status: "foster" })
      .eq("id", animalId);
    await service.from("animal_status_events").insert({
      animal_id: animalId,
      from_status: fromStatus ?? null,
      to_status: "foster",
      note: "Předáno do dočasné péče",
      changed_by: user.id,
    });
  }

  revalidate(animalId, input.carer_id);
  return { ok: true };
}

export interface EndPlacementInput {
  ended_on: string;
  end_reason: string;
  /** Stav, do kterého se zvíře vrátí (available = zpět k adopci). */
  return_status: "available" | "intake" | "keep";
  notes: string;
}

/**
 * Ukončí běžící umístění v dočasné péči. Volitelně vrátí zvíře zpět
 * mezi dostupná / na příjem (jinak ponechá stávající stav).
 */
export async function endFosterPlacement(
  animalId: string,
  placementId: string,
  input: EndPlacementInput,
): Promise<ActionResult> {
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();
  const animal = await assertOwned(service, animalId, institutionId);
  if (!animal) return { error: "Zvíře nepatří tvému útulku." };

  const { data: placement } = await service
    .from("foster_placements")
    .select("carer_id, notes")
    .eq("id", placementId)
    .eq("animal_id", animalId)
    .maybeSingle();

  const { error: updErr } = await service
    .from("foster_placements")
    .update({
      ended_on: input.ended_on || todayStr(),
      end_reason: blank(input.end_reason),
      notes: blank(input.notes) ??
        (placement as { notes: string | null } | null)?.notes ??
        null,
    })
    .eq("id", placementId)
    .eq("animal_id", animalId);
  if (updErr) return { error: updErr.message };

  if (input.return_status !== "keep") {
    const { data: cur } = await service
      .from("animals")
      .select("adoption_status")
      .eq("id", animalId)
      .maybeSingle();
    const fromStatus = (cur as { adoption_status: AdoptionStatus } | null)
      ?.adoption_status;
    if (fromStatus !== input.return_status) {
      await service
        .from("animals")
        .update({ adoption_status: input.return_status })
        .eq("id", animalId);
      await service.from("animal_status_events").insert({
        animal_id: animalId,
        from_status: fromStatus ?? null,
        to_status: input.return_status,
        note: "Ukončena dočasná péče",
        changed_by: user.id,
      });
    }
  }

  revalidate(
    animalId,
    (placement as { carer_id: string } | null)?.carer_id,
  );
  return { ok: true };
}

export async function deleteFosterPlacement(
  animalId: string,
  placementId: string,
): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();
  const animal = await assertOwned(service, animalId, institutionId);
  if (!animal) return { error: "Zvíře nepatří tvému útulku." };

  const { data: placement } = await service
    .from("foster_placements")
    .select("carer_id")
    .eq("id", placementId)
    .eq("animal_id", animalId)
    .maybeSingle();

  const { error } = await service
    .from("foster_placements")
    .delete()
    .eq("id", placementId)
    .eq("animal_id", animalId);
  if (error) return { error: error.message };

  revalidate(
    animalId,
    (placement as { carer_id: string } | null)?.carer_id,
  );
  return { ok: true };
}
