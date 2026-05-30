import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { HISTORY_FIELD_LABEL } from "@/lib/animal-history";
import { ADOPTION_STATUS_LABEL, ADOPTION_STATUS_PILL } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdoptionStatus } from "@/types/database";

import { TabPlaceholder } from "../tab-placeholder";
import { HistoryExport } from "./history-export";

export const metadata = { title: "Historie — Zozio Admin" };

interface PageProps {
  params: Promise<{ id: string }>;
}

interface StatusRow {
  from_status: AdoptionStatus | null;
  to_status: AdoptionStatus;
  note: string | null;
  changed_by: string | null;
  created_at: string;
}

interface FieldRow {
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  created_at: string;
}

/** Sjednocený řádek historie pro vykreslení časové osy. */
interface Entry {
  kind: "status" | "field";
  created_at: string;
  changed_by: string | null;
  label: string;
  old: string;
  new: string;
  fromStatus?: AdoptionStatus | null;
  toStatus?: AdoptionStatus;
  note?: string | null;
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

  // Posledních 20 z každého zdroje, pak sloučíme a vezmeme 20 nejnovějších.
  const [statusRes, fieldRes] = await Promise.all([
    supabase
      .from("animal_status_events")
      .select("from_status, to_status, note, changed_by, created_at")
      .eq("animal_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("animal_field_history")
      .select("field, old_value, new_value, changed_by, created_at")
      .eq("animal_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const entries: Entry[] = [];

  for (const s of (statusRes.data ?? []) as StatusRow[]) {
    entries.push({
      kind: "status",
      created_at: s.created_at,
      changed_by: s.changed_by,
      label: "Adopční stav",
      old: s.from_status ? ADOPTION_STATUS_LABEL[s.from_status] : "—",
      new: ADOPTION_STATUS_LABEL[s.to_status],
      fromStatus: s.from_status,
      toStatus: s.to_status,
      note: s.note,
    });
  }
  for (const f of (fieldRes.data ?? []) as FieldRow[]) {
    entries.push({
      kind: "field",
      created_at: f.created_at,
      changed_by: f.changed_by,
      label: HISTORY_FIELD_LABEL[f.field] ?? f.field,
      old: f.old_value ?? "—",
      new: f.new_value ?? "—",
    });
  }

  entries.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const recent = entries.slice(0, 20);

  if (recent.length === 0) {
    return (
      <div className="space-y-6">
        <HistoryExport animalId={id} />
        <TabPlaceholder
          icon="🕓"
          title="Zatím žádná historie"
          description="Jakmile upravíš údaje zvířete nebo změníš jeho stav, objeví se tu časová osa všech změn — kdo, kdy a z čeho na co."
        />
      </div>
    );
  }

  // Vyřeš jména autorů změn (auth.users přes service klienta).
  const actorIds = [
    ...new Set(recent.map((e) => e.changed_by).filter(Boolean)),
  ] as string[];
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
    <div className="space-y-6">
      <HistoryExport animalId={id} />

      <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
        <h2 className="mb-1 font-display text-xl font-bold text-ink-900">
          Posledních {recent.length} změn
        </h2>
        <p className="mb-5 text-sm text-ink-500">
          Změny stavu i jednotlivých údajů zvířete.
        </p>
        <ol className="relative space-y-6 border-l border-ink-900/10 pl-6">
          {recent.map((e, i) => (
            <li key={`${e.kind}-${e.created_at}-${i}`} className="relative">
              <span
                className={cn(
                  "absolute -left-[31px] top-1 size-3 rounded-full ring-4 ring-cream",
                  e.kind === "status" ? "bg-meadow-500" : "bg-sage-500",
                )}
              />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-ink-900">
                  {e.label}
                </span>
                {e.kind === "status" ? (
                  <span className="flex flex-wrap items-center gap-2">
                    {e.fromStatus && (
                      <>
                        <span
                          className={cn(
                            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                            ADOPTION_STATUS_PILL[e.fromStatus],
                          )}
                        >
                          {ADOPTION_STATUS_LABEL[e.fromStatus]}
                        </span>
                        <ArrowRight className="size-3.5 text-ink-400" />
                      </>
                    )}
                    {e.toStatus && (
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          ADOPTION_STATUS_PILL[e.toStatus],
                        )}
                      >
                        {ADOPTION_STATUS_LABEL[e.toStatus]}
                      </span>
                    )}
                  </span>
                ) : (
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-md bg-cream-warm px-2 py-0.5 text-ink-600 line-through decoration-ink-400">
                      {e.old}
                    </span>
                    <ArrowRight className="size-3.5 text-ink-400" />
                    <span className="rounded-md bg-sage-50 px-2 py-0.5 font-medium text-ink-900">
                      {e.new}
                    </span>
                  </span>
                )}
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
    </div>
  );
}
