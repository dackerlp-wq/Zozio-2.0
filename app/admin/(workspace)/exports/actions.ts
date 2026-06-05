"use server";

import { revalidatePath } from "next/cache";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

type ActionResult = { error: string } | { ok: true };

const PAID_PLANS = ["standard", "pro"];

/** Přepne naplánovaný měsíční export (jen placené tarify, vedoucí). */
export async function toggleScheduledExport(
  kind: "kvs" | "accounting",
  enabled: boolean,
): Promise<ActionResult> {
  const { institutionId, role } = await requireMembership();
  if (role !== "owner" && role !== "admin") {
    return { error: "Nastavení může měnit jen vedoucí." };
  }
  const service = createServiceClient();

  const { data: inst } = await service
    .from("institutions")
    .select("plan")
    .eq("id", institutionId)
    .maybeSingle();
  const plan = (inst as { plan: string } | null)?.plan ?? "free";
  if (enabled && !PAID_PLANS.includes(plan)) {
    return { error: "Naplánované exporty jsou jen v placených tarifech." };
  }

  const patch =
    kind === "kvs"
      ? { export_kvs_monthly: enabled }
      : { export_accounting_monthly: enabled };
  const { error } = await service
    .from("institutions")
    .update(patch)
    .eq("id", institutionId);
  if (error) return { error: error.message };

  revalidatePath("/admin/exports");
  return { ok: true };
}

/** Označí položku historie jako odevzdanou KVS (důkaz při kontrole). */
export async function markSubmitted(logId: string): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();

  const { error } = await service
    .from("export_log")
    .update({ submitted_to_kvs: true, submitted_at: new Date().toISOString() })
    .eq("id", logId)
    .eq("institution_id", institutionId);
  if (error) return { error: error.message };

  revalidatePath("/admin/exports");
  return { ok: true };
}

/** Uloží šablonu sloupců pro datový přehled. */
export async function saveColumnTemplate(input: {
  reportKey: string;
  name: string;
  columns: string[];
}): Promise<ActionResult> {
  const { institutionId, user } = await requireMembership();
  if (!input.name.trim()) return { error: "Zadej název šablony." };
  if (input.columns.length === 0) return { error: "Vyber aspoň jeden sloupec." };
  const service = createServiceClient();

  const { error } = await service.from("export_column_templates").insert({
    institution_id: institutionId,
    report_key: input.reportKey,
    name: input.name.trim(),
    columns: input.columns,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/exports");
  return { ok: true };
}

export async function deleteColumnTemplate(id: string): Promise<ActionResult> {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();

  const { error } = await service
    .from("export_column_templates")
    .delete()
    .eq("id", id)
    .eq("institution_id", institutionId);
  if (error) return { error: error.message };

  revalidatePath("/admin/exports");
  return { ok: true };
}
