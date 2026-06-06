"use server";

import { revalidatePath } from "next/cache";

import { requireMembership, ensurePermission } from "@/lib/auth";
import { KENNEL_QUARANTINE_KINDS } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";
import type { KennelKind, KennelStatus } from "@/types/database";

type ActionResult = { error: string } | { ok: true };

/**
 * Přesune zvíře do kotce (nebo ho z kotce vyřadí, když kennelId == null).
 * Uzavře aktivní umístění a otevře nové → historie přesunů.
 */
export async function moveAnimalToKennel(
  animalId: string,
  kennelId: string | null,
  note?: string,
): Promise<ActionResult> {
  const __perm = await ensurePermission("kennels");
  if (!__perm.ok) return { error: __perm.error };
  const { institutionId, user } = await requireMembership();
  const service = createServiceClient();

  const { data: animal } = await service
    .from("animals")
    .select("id, kennel_id")
    .eq("id", animalId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!animal) return { error: "Zvíře nepatří tvému útulku." };

  const currentKennel = (animal as { kennel_id: string | null }).kennel_id;
  if (currentKennel === kennelId) return { ok: true };

  // Ověř cílový kotec + tvrdé zábrany (kapacita / mimo provoz / karanténa).
  if (kennelId) {
    const { data: kennel } = await service
      .from("kennels")
      .select("id, kind, status, capacity")
      .eq("id", kennelId)
      .eq("institution_id", institutionId)
      .maybeSingle();
    if (!kennel) return { error: "Kotec nepatří tvému útulku." };

    const k = kennel as {
      id: string;
      kind: KennelKind;
      status: KennelStatus;
      capacity: number;
    };

    if (k.status === "out_of_service")
      return { error: "Kotec je mimo provoz — nelze do něj přesunout." };

    const { count } = await service
      .from("animals")
      .select("id", { count: "exact", head: true })
      .eq("kennel_id", kennelId)
      .eq("institution_id", institutionId);
    if ((count ?? 0) >= k.capacity)
      return { error: "Kotec je plný — uvolni místo nebo vyber jiný." };

    // Karanténní zábrana: zvíře v aktivní karanténě nesmí do běžného kotce.
    if (!KENNEL_QUARANTINE_KINDS.includes(k.kind)) {
      const { count: quarCount } = await service
        .from("quarantine_records")
        .select("id", { count: "exact", head: true })
        .eq("animal_id", animalId)
        .is("ended_on", null);
      if ((quarCount ?? 0) > 0)
        return {
          error: "Přesun do běžného kotce blokován — probíhá karanténa.",
        };
    }
  }

  const now = new Date().toISOString();

  // Uzavři aktivní umístění.
  await service
    .from("kennel_assignments")
    .update({ moved_out_at: now })
    .eq("animal_id", animalId)
    .is("moved_out_at", null);

  // Otevři nové umístění (jen pokud se přesouvá do kotce).
  if (kennelId) {
    const { error: insErr } = await service
      .from("kennel_assignments")
      .insert({
        animal_id: animalId,
        kennel_id: kennelId,
        moved_in_at: now,
        note: note?.trim() || null,
        created_by: user.id,
      });
    if (insErr) return { error: insErr.message };
  }

  const { error: updErr } = await service
    .from("animals")
    .update({ kennel_id: kennelId })
    .eq("id", animalId);
  if (updErr) return { error: updErr.message };

  revalidatePath("/admin/kennels");
  revalidatePath(`/admin/animals/${animalId}/ustajeni`);
  revalidatePath(`/admin/animals/${animalId}`);
  return { ok: true };
}

/**
 * Hromadný přesun: přesune VŠECHNA zvířata z jednoho kotce do jiného
 * (čištění / rekonstrukce). Uzavře jejich aktivní umístění a otevře nová.
 */
export async function moveWholeKennel(
  fromKennelId: string,
  toKennelId: string,
  note?: string,
): Promise<ActionResult> {
  const __perm = await ensurePermission("kennels");
  if (!__perm.ok) return { error: __perm.error };
  const { institutionId, user } = await requireMembership();
  if (fromKennelId === toKennelId) return { error: "Zdrojový a cílový kotec jsou stejné." };
  const service = createServiceClient();

  // Ověř, že oba kotce patří útulku.
  const { data: kennels } = await service
    .from("kennels")
    .select("id")
    .eq("institution_id", institutionId)
    .in("id", [fromKennelId, toKennelId]);
  if (!kennels || kennels.length !== 2) {
    return { error: "Kotec nepatří tvému útulku." };
  }

  // Zvířata aktuálně v původním kotci.
  const { data: animalsData } = await service
    .from("animals")
    .select("id")
    .eq("institution_id", institutionId)
    .eq("kennel_id", fromKennelId);
  const animalIds = (animalsData ?? []).map((a) => (a as { id: string }).id);
  if (animalIds.length === 0) return { error: "V kotci nejsou žádná zvířata." };

  const now = new Date().toISOString();

  // Uzavři aktivní umístění všech a otevři nová.
  await service
    .from("kennel_assignments")
    .update({ moved_out_at: now })
    .in("animal_id", animalIds)
    .is("moved_out_at", null);

  const { error: insErr } = await service.from("kennel_assignments").insert(
    animalIds.map((animal_id) => ({
      animal_id,
      kennel_id: toKennelId,
      moved_in_at: now,
      note: note?.trim() || "Hromadný přesun kotce",
      created_by: user.id,
    })),
  );
  if (insErr) return { error: insErr.message };

  const { error: updErr } = await service
    .from("animals")
    .update({ kennel_id: toKennelId })
    .in("id", animalIds);
  if (updErr) return { error: updErr.message };

  revalidatePath("/admin/kennels");
  for (const id of animalIds) {
    revalidatePath(`/admin/animals/${id}/ustajeni`);
  }
  return { ok: true };
}
