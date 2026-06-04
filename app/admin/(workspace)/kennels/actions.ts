"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth";
import { KENNEL_QUARANTINE_KINDS } from "@/lib/format";
import { createServiceClient } from "@/lib/supabase/service";
import type { KennelKind, KennelStatus, Species } from "@/types/database";

type ActionResult = { error: string } | { ok: true };

export interface KennelInput {
  name: string;
  capacity: number;
  kind: KennelKind;
  status: KennelStatus;
  zone: string;
  species_allowed: Species[];
  is_heated: boolean;
  is_accessible: boolean;
  is_maternity: boolean;
  photo_url: string;
  out_of_service_reason: string;
  out_of_service_until: string;
  notes: string;
}

function buildRow(input: KennelInput) {
  // „Mimo provoz" detaily dávají smysl jen u stavu out_of_service.
  const oos = input.status === "out_of_service";
  return {
    name: input.name.trim(),
    capacity: input.capacity > 0 ? input.capacity : 1,
    kind: input.kind,
    status: input.status,
    zone: input.zone.trim() || null,
    species_allowed: input.species_allowed,
    is_heated: input.is_heated,
    is_accessible: input.is_accessible,
    is_maternity: input.is_maternity,
    photo_url: input.photo_url.trim() || null,
    out_of_service_reason: oos ? input.out_of_service_reason.trim() || null : null,
    out_of_service_until: oos ? input.out_of_service_until || null : null,
    // is_quarantine držíme synchronně s typem kvůli zpětné kompatibilitě.
    is_quarantine: KENNEL_QUARANTINE_KINDS.includes(input.kind),
    notes: input.notes.trim() || null,
  };
}

export async function createKennel(input: KennelInput): Promise<ActionResult> {
  const { institutionId, role } = await requireMembership();
  if (!["owner", "admin", "staff"].includes(role))
    return { error: "Nemáš oprávnění." };
  if (!input.name.trim()) return { error: "Zadej název kotce." };

  const service = createServiceClient();
  const { error } = await service.from("kennels").insert({
    institution_id: institutionId,
    ...buildRow(input),
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/kennels");
  return { ok: true };
}

export async function updateKennel(
  id: string,
  input: KennelInput,
): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  if (!input.name.trim()) return { error: "Zadej název kotce." };

  const service = createServiceClient();
  const { error } = await service
    .from("kennels")
    .update(buildRow(input))
    .eq("id", id)
    .eq("institution_id", institutionId);
  if (error) return { error: error.message };

  revalidatePath("/admin/kennels");
  return { ok: true };
}

export interface KennelHistoryRow {
  id: string;
  animalId: string;
  animalName: string;
  movedIn: string;
  movedOut: string | null;
  note: string | null;
}

/** Historie kotce — kdo jím prošel (poslední umístění shora). */
export async function loadKennelHistory(
  kennelId: string,
): Promise<{ rows: KennelHistoryRow[] } | { error: string }> {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();

  const { data: kennel } = await service
    .from("kennels")
    .select("id")
    .eq("id", kennelId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!kennel) return { error: "Kotec nepatří tvému útulku." };

  const { data, error } = await service
    .from("kennel_assignments")
    .select("id, moved_in_at, moved_out_at, note, animals(id, name)")
    .eq("kennel_id", kennelId)
    .order("moved_in_at", { ascending: false })
    .limit(50);
  if (error) return { error: error.message };

  const rows: KennelHistoryRow[] = (
    (data ?? []) as unknown as {
      id: string;
      moved_in_at: string;
      moved_out_at: string | null;
      note: string | null;
      animals: { id: string; name: string } | null;
    }[]
  ).map((r) => ({
    id: r.id,
    animalId: r.animals?.id ?? "",
    animalName: r.animals?.name ?? "—",
    movedIn: r.moved_in_at,
    movedOut: r.moved_out_at,
    note: r.note,
  }));
  return { rows };
}

export async function deleteKennel(id: string): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();

  // Kotec nelze smazat, pokud v něm je obsazené zvíře.
  const { count } = await service
    .from("animals")
    .select("id", { count: "exact", head: true })
    .eq("kennel_id", id)
    .eq("institution_id", institutionId);
  if (count && count > 0)
    return { error: "Kotec je obsazený — nejprve přesuň zvířata jinam." };

  const { error } = await service
    .from("kennels")
    .delete()
    .eq("id", id)
    .eq("institution_id", institutionId);
  if (error) return { error: error.message };

  revalidatePath("/admin/kennels");
  return { ok: true };
}
