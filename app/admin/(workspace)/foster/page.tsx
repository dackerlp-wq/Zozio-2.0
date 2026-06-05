import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { FosterCarerRow } from "@/types/database";

import { FosterList, type CarerListItem } from "./foster-list";

export const metadata = { title: "Pěstouni — Zozio Admin" };

export default async function FosterAdminPage() {
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const [{ data: carerData }, { data: placementData }] = await Promise.all([
    supabase
      .from("foster_carers")
      .select("*")
      .eq("institution_id", institutionId)
      .order("is_active", { ascending: false })
      .order("name", { ascending: true }),
    supabase
      .from("foster_placements")
      .select("carer_id, animals(name)")
      .eq("institution_id", institutionId)
      .is("ended_on", null),
  ]);

  const carers = (carerData ?? []) as FosterCarerRow[];
  const placements = (placementData ?? []) as {
    carer_id: string;
    animals: { name: string } | null;
  }[];

  const byCarer = new Map<string, string[]>();
  for (const p of placements) {
    const list = byCarer.get(p.carer_id) ?? [];
    if (p.animals?.name) list.push(p.animals.name);
    byCarer.set(p.carer_id, list);
  }

  const rows: CarerListItem[] = carers.map((c) => {
    const animals = byCarer.get(c.id) ?? [];
    return {
      id: c.id,
      name: c.name,
      city: c.city,
      phone: c.phone,
      email: c.email,
      capacity: c.capacity,
      is_active: c.is_active,
      activeCount: animals.length,
      activeAnimals: animals,
      tags: c.tags ?? [],
      species_note: c.species_note,
      unavailable_until: c.unavailable_until,
    };
  });

  return (
    <div className="mx-auto max-w-5xl">
      <FosterList carers={rows} />
    </div>
  );
}
