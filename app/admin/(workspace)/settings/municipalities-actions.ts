"use server";

import { revalidatePath } from "next/cache";

import { ensurePermission } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

export interface Muni {
  kod: number;
  nazev: string;
  okres: number | null;
}

/** Obce ve spádové oblasti přihlášeného útulku. */
export async function listMyMunicipalities(): Promise<Muni[]> {
  const perm = await ensurePermission("settings");
  if (!perm.ok) return [];
  const service = createServiceClient();
  const { data } = await service
    .from("shelter_municipalities")
    .select("obec_kod, obec_nazev, okres_kod")
    .eq("institution_id", perm.membership.institutionId)
    .order("obec_nazev", { ascending: true });
  return ((data ?? []) as { obec_kod: number; obec_nazev: string; okres_kod: number | null }[]).map(
    (r) => ({ kod: r.obec_kod, nazev: r.obec_nazev, okres: r.okres_kod }),
  );
}

/** Vlastnictví obcí pro admin mapu: moje obce vs. obce zabrané jiným útulkem. */
export async function loadOwnershipForMap(): Promise<{
  mineKods: number[];
  otherKods: number[];
}> {
  const perm = await ensurePermission("settings");
  if (!perm.ok) return { mineKods: [], otherKods: [] };
  const service = createServiceClient();
  const { data } = await service
    .from("shelter_municipalities")
    .select("obec_kod, institution_id");
  const mine: number[] = [];
  const other: number[] = [];
  for (const r of (data ?? []) as { obec_kod: number; institution_id: string }[]) {
    if (r.institution_id === perm.membership.institutionId) mine.push(r.obec_kod);
    else other.push(r.obec_kod);
  }
  return { mineKods: mine, otherKods: other };
}

export type AddResult =
  | { ok: true; added: number; conflicts: { kod: number; nazev: string }[] }
  | { error: string };

/** Přidá obce do spádové oblasti. Kolize (obec patří jinému útulku) přeskočí a nahlásí. */
export async function addMunicipalities(obce: Muni[]): Promise<AddResult> {
  const perm = await ensurePermission("settings");
  if (!perm.ok) return { error: perm.error };
  const institutionId = perm.membership.institutionId;
  const service = createServiceClient();

  const kods = [...new Set(obce.map((o) => o.kod))];
  if (kods.length === 0) return { ok: true, added: 0, conflicts: [] };

  // Zjisti, které obce už někdo má.
  const { data: existing } = await service
    .from("shelter_municipalities")
    .select("obec_kod, institution_id")
    .in("obec_kod", kods);
  const owner = new Map<number, string>();
  for (const e of (existing ?? []) as { obec_kod: number; institution_id: string }[]) {
    owner.set(e.obec_kod, e.institution_id);
  }

  const conflicts: { kod: number; nazev: string }[] = [];
  const toInsert = obce.filter((o) => {
    const own = owner.get(o.kod);
    if (!own) return true; // volná
    if (own === institutionId) return false; // už moje
    conflicts.push({ kod: o.kod, nazev: o.nazev }); // patří jinému útulku
    return false;
  });

  if (toInsert.length > 0) {
    const { error } = await service.from("shelter_municipalities").insert(
      toInsert.map((o) => ({
        institution_id: institutionId,
        obec_kod: o.kod,
        obec_nazev: o.nazev,
        okres_kod: o.okres,
      })),
    );
    if (error) return { error: error.message };
  }

  revalidatePath("/mapa");
  revalidatePath("/admin/settings");
  return { ok: true, added: toInsert.length, conflicts };
}

/** Odebere obec ze spádové oblasti přihlášeného útulku. */
export async function removeMunicipality(kod: number): Promise<{ ok: true } | { error: string }> {
  const perm = await ensurePermission("settings");
  if (!perm.ok) return { error: perm.error };
  const service = createServiceClient();
  const { error } = await service
    .from("shelter_municipalities")
    .delete()
    .eq("institution_id", perm.membership.institutionId)
    .eq("obec_kod", kod);
  if (error) return { error: error.message };
  revalidatePath("/mapa");
  revalidatePath("/admin/settings");
  return { ok: true };
}
