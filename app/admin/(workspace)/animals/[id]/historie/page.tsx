import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ADOPTION_STATUS_LABEL, ADOPTION_STATUS_PILL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdoptionStatus } from "@/types/database";

import { TabPlaceholder } from "../tab-placeholder";

export const metadata = { title: "Historie — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

interface EventRow {
  id: string;
  from_status: AdoptionStatus | null;
  to_status: AdoptionStatus;
  note: string | null;
  changed_by: string | null;
  created_at: string;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AnimalHistoryPage({ params }: PageProps) {
  const { id } = await params;
  const { institutionId } = await requireMembership();
  const supabase = await createClient();

  // Ochrana: zvíře musí patřit útulku.
  const { data: owned } = await supabase
    .from("animals")
    .select("id")
    .eq("id", id)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!owned) notFound();

  const { data } = await supabase
    .from("animal_status_events")
    .select("id, from_status, to_status, note, changed_by, created_at")
    .eq("animal_id", id)
    .order("created_at", { ascending: false });

  const events = (data ?? []) as EventRow[];

  if (events.length === 0) {
    return (
      <TabPlaceholder
        icon="🕓"
        title="Zatím žádná historie"
        description="Jakmile změníš životní stav zvířete (záložka Přehled → Změnit stav), objeví se tu časová osa všech změn."
      />
    );
  }

  // Vyřeš jména autorů změn (auth.users přes service klienta).
  const actorIds = [...new Set(events.map((e) => e.changed_by).filter(Boolean))] as string[];
  const actorNames = new Map<string, string>();
  if (actorIds.length > 0) {
    const service = createServiceClient();
    await Promise.all(
      actorIds.map(async (uid) => {
        const { data: u } = await service.auth.admin.getUserById(uid);
        const name =
          (u?.user?.user_metadata?.full_name as string | undefined) ||
          (u?.user?.user_metadata?.name as string | undefined) ||
          u?.user?.email ||
          null;
        if (name) actorNames.set(uid, name);
      }),
    );
  }

  return (
    <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
      <h2 className="mb-5 font-display text-xl font-bold text-ink-900">
        Životní cyklus
      </h2>
      <ol className="relative space-y-6 border-l border-ink-900/10 pl-6">
        {events.map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute -left-[31px] top-1 size-3 rounded-full bg-meadow-500 ring-4 ring-cream" />
            <div className="flex flex-wrap items-center gap-2">
              {e.from_status && (
                <>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                      ADOPTION_STATUS_PILL[e.from_status],
                    )}
                  >
                    {ADOPTION_STATUS_LABEL[e.from_status]}
                  </span>
                  <ArrowRight className="size-3.5 text-ink-400" />
                </>
              )}
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                  ADOPTION_STATUS_PILL[e.to_status],
                )}
              >
                {ADOPTION_STATUS_LABEL[e.to_status]}
              </span>
            </div>
            <div className="mt-1 text-xs text-ink-500">
              {formatDateTime(e.created_at)}
              {e.changed_by && actorNames.get(e.changed_by) && (
                <> · {actorNames.get(e.changed_by)}</>
              )}
            </div>
            {e.note && (
              <p className="mt-2 whitespace-pre-line rounded-xl bg-cream-warm px-3 py-2 text-sm text-ink-700">
                {e.note}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
