import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { KennelRow } from "@/types/database";

import { KennelManager, type KennelWithOccupancy } from "./kennel-manager";

export const metadata = { title: "Kotce — Zozio Admin" };

export default async function KennelsAdminPage() {
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const [{ data: kennelData }, { data: animalData }] = await Promise.all([
    supabase
      .from("kennels")
      .select("*")
      .eq("institution_id", institutionId)
      .order("name", { ascending: true }),
    supabase
      .from("animals")
      .select("id, name, kennel_id")
      .eq("institution_id", institutionId),
  ]);

  const kennels = (kennelData ?? []) as KennelRow[];
  const animals = (animalData ?? []) as {
    id: string;
    name: string;
    kennel_id: string | null;
  }[];

  const occupancy = new Map<string, string[]>();
  for (const a of animals) {
    if (!a.kennel_id) continue;
    const list = occupancy.get(a.kennel_id) ?? [];
    list.push(a.name);
    occupancy.set(a.kennel_id, list);
  }

  const rows: KennelWithOccupancy[] = kennels.map((k) => ({
    ...k,
    occupants: occupancy.get(k.id) ?? [],
  }));

  const unassigned = animals.filter((a) => !a.kennel_id).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
          Kotce
        </h2>
        <p className="mt-1 text-ink-600">
          {kennels.length} kotců · {unassigned} zvířat bez kotce
        </p>
      </div>

      <KennelManager rows={rows} />
    </div>
  );
}
