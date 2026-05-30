import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { KennelAssigner, type KennelOption } from "../kennel-assigner";

export const metadata = { title: "Ustájení — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

interface AssignmentRow {
  id: string;
  kennel_id: string;
  moved_in_at: string;
  moved_out_at: string | null;
  note: string | null;
  kennels: { name: string } | null;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });
}

export default async function AnimalKennelPage({ params }: PageProps) {
  const { id } = await params;
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  const { data: animal } = await supabase
    .from("animals")
    .select("id, kennel_id")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!animal) notFound();
  const currentKennelId = (animal as { kennel_id: string | null }).kennel_id;

  const [{ data: kennelData }, { data: animalData }, { data: historyData }] =
    await Promise.all([
      supabase
        .from("kennels")
        .select("id, name, capacity, is_quarantine")
        .eq("institution_id", institutionId)
        .order("name", { ascending: true }),
      supabase
        .from("animals")
        .select("kennel_id")
        .eq("institution_id", institutionId),
      supabase
        .from("kennel_assignments")
        .select("id, kennel_id, moved_in_at, moved_out_at, note, kennels(name)")
        .eq("animal_id", id)
        .order("moved_in_at", { ascending: false }),
    ]);

  const occCount = new Map<string, number>();
  for (const a of (animalData ?? []) as { kennel_id: string | null }[]) {
    if (a.kennel_id)
      occCount.set(a.kennel_id, (occCount.get(a.kennel_id) ?? 0) + 1);
  }

  const kennels: KennelOption[] = (
    (kennelData ?? []) as {
      id: string;
      name: string;
      capacity: number;
      is_quarantine: boolean;
    }[]
  ).map((k) => ({
    id: k.id,
    name: k.name,
    capacity: k.capacity,
    is_quarantine: k.is_quarantine,
    occupied: occCount.get(k.id) ?? 0,
  }));

  const history = (historyData ?? []) as unknown as AssignmentRow[];

  return (
    <div className="space-y-6">
      <KennelAssigner
        animalId={id}
        currentKennelId={currentKennelId}
        kennels={kennels}
      />

      <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
        <h2 className="mb-4 font-display text-xl font-bold text-ink-900">
          Historie přesunů
        </h2>
        {history.length === 0 ? (
          <p className="text-sm text-ink-500">Zatím žádné přesuny.</p>
        ) : (
          <ol className="space-y-3">
            {history.map((h) => (
              <li
                key={h.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-l-2 border-ink-900/10 pl-4 text-sm"
              >
                <span className="font-semibold text-ink-900">
                  {h.kennels?.name ?? "Kotec"}
                </span>
                <span className="inline-flex items-center gap-1.5 text-ink-500">
                  {formatDate(h.moved_in_at)}
                  <ArrowRight className="size-3" />
                  {h.moved_out_at ? formatDate(h.moved_out_at) : "dosud"}
                </span>
                {h.note && <span className="text-ink-600">· {h.note}</span>}
                {!h.moved_out_at && (
                  <span className="rounded-full bg-sage-100 px-2 py-0.5 text-xs font-semibold text-sage-700">
                    Aktuální
                  </span>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
