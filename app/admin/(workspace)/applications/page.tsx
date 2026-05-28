import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { requireMembership } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_PILL,
} from "@/lib/format";
import type { ApplicationStatus } from "@/types/database";

export const metadata = { title: "Žádosti — Zozio Admin" };

interface Row {
  id: string;
  applicant_name: string;
  applicant_city: string | null;
  status: ApplicationStatus;
  created_at: string;
  animal: { name: string; primary_photo_url: string | null } | null;
}

interface PageProps {
  searchParams: Promise<{ status?: string }>;
}

const FILTERS: { value: string; label: string }[] = [
  { value: "all", label: "Vše" },
  { value: "new", label: "Nové" },
  { value: "active", label: "Probíhající" },
  { value: "completed", label: "Dokončené" },
  { value: "rejected", label: "Zamítnuté" },
];

const ACTIVE_STATUSES: ApplicationStatus[] = [
  "review",
  "phone_contact",
  "in_person_meeting",
  "approved",
  "contract_signed",
];

function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function ApplicationsPage({ searchParams }: PageProps) {
  const { institutionId } = await requireMembership();
  const { status: filter = "new" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("applications")
    .select(
      "id, applicant_name, applicant_city, status, created_at, animal:animals(name, primary_photo_url)",
    )
    .eq("institution_id", institutionId)
    .order("created_at", { ascending: false });

  if (filter === "new") query = query.eq("status", "new");
  else if (filter === "active") query = query.in("status", ACTIVE_STATUSES);
  else if (filter === "completed") query = query.eq("status", "completed");
  else if (filter === "rejected") query = query.eq("status", "rejected");

  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900">
          Žádosti o adopci
        </h2>
        <p className="mt-1 text-ink-600">
          Zájemci o tvá zvířata na jednom místě.
        </p>
      </div>

      {/* Filtr */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = filter === f.value;
          return (
            <Link
              key={f.value}
              href={`/admin/applications?status=${f.value}`}
              className={
                active
                  ? "rounded-full bg-sage-500 px-4 py-1.5 text-sm font-semibold text-cream"
                  : "rounded-full bg-cream px-4 py-1.5 text-sm font-semibold text-ink-600 ring-1 ring-ink-900/8 hover:bg-sage-100"
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-3xl bg-cream p-12 text-center ring-1 ring-ink-900/8">
          <div className="text-4xl">📨</div>
          <h3 className="mt-4 font-display text-xl font-semibold text-ink-900">
            Žádné žádosti
          </h3>
          <p className="mt-2 text-ink-600">
            Jakmile někdo projeví zájem o adopci, objeví se tady.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-3xl bg-cream ring-1 ring-ink-900/8">
          <ul className="divide-y divide-ink-900/8">
            {rows.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/admin/applications/${a.id}`}
                  className="flex items-center gap-4 p-4 transition hover:bg-sage-50"
                >
                  <div className="size-12 shrink-0 overflow-hidden rounded-xl bg-cream-warm">
                    {a.animal?.primary_photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={a.animal.primary_photo_url}
                        alt={a.animal.name}
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-xl">
                        🐾
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="font-display text-lg font-bold text-ink-900">
                      {a.applicant_name}
                    </div>
                    <div className="truncate text-sm text-ink-600">
                      {[
                        a.animal?.name ? `o ${a.animal.name}` : null,
                        a.applicant_city,
                        dateLabel(a.created_at),
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>

                  <span
                    className={`hidden shrink-0 rounded-full px-3 py-1 text-xs font-semibold sm:inline ${APPLICATION_STATUS_PILL[a.status]}`}
                  >
                    {APPLICATION_STATUS_LABEL[a.status]}
                  </span>

                  <ChevronRight className="size-5 shrink-0 text-ink-400" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
