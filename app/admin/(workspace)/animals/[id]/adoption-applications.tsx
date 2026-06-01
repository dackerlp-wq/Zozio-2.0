"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  APPLICATION_STATUS_LABEL,
  APPLICATION_STATUS_PILL,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { ApplicationStatus } from "@/types/database";

import { rejectApplication } from "../../applications/actions";
import type { ApplicationVM } from "./adoption-sections";

const PIPELINE: { key: string; label: string; statuses: ApplicationStatus[] }[] = [
  { key: "new", label: "Nová", statuses: ["new"] },
  { key: "contacted", label: "Kontaktováno", statuses: ["review", "phone_contact"] },
  { key: "meeting", label: "Schůzka", statuses: ["in_person_meeting"] },
  { key: "approved", label: "Schváleno", statuses: ["approved", "contract_signed"] },
];

const TONE_PILL: Record<"high" | "mid" | "low", string> = {
  high: "bg-fern-50 text-fern-700",
  mid: "bg-sunshine-200 text-ink-700",
  low: "bg-meadow-50 text-meadow-700",
};

function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "short" });
}

export function AdoptionApplications({
  applications,
  hasActiveTrial,
  readOnly,
  onStart,
}: {
  applications: ApplicationVM[];
  hasActiveTrial: boolean;
  readOnly: boolean;
  onStart: (app: ApplicationVM) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const counts = (statuses: ApplicationStatus[]) =>
    applications.filter((a) => statuses.includes(a.status)).length;

  function doReject(id: string) {
    setErr(null);
    startTransition(async () => {
      const res = await rejectApplication(id, reason.trim() || "Nevhodný zájemce");
      if ("error" in res) {
        setErr(res.error);
        return;
      }
      setRejecting(null);
      setReason("");
      router.refresh();
    });
  }

  return (
    <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
      <h2 className="font-display text-xl font-bold text-ink-900">
        <span className="mr-2">📨</span>Žádosti o adopci
      </h2>
      <p className="mt-0.5 text-sm text-ink-500">
        Zájemci z veřejného profilu (zozio.cz) · skríning podle požadavků zvířete
      </p>

      {/* Pipeline */}
      <div className="mt-4 flex items-center gap-1 overflow-x-auto pb-1">
        {PIPELINE.map((s, i) => (
          <div key={s.key} className="flex items-center gap-1">
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill bg-cream-warm px-3 py-1.5 text-xs font-bold text-ink-700">
              {s.label}
              <span className="rounded-pill bg-cream px-1.5 text-[11px]">{counts(s.statuses)}</span>
            </span>
            <span className="text-ink-300">›</span>
          </div>
        ))}
        <span
          className={cn(
            "inline-flex items-center gap-1.5 whitespace-nowrap rounded-pill px-3 py-1.5 text-xs font-bold",
            hasActiveTrial ? "bg-meadow-500 text-cream" : "bg-cream-warm text-ink-700",
          )}
        >
          Zkušebka
          <span className={cn("rounded-pill px-1.5 text-[11px]", hasActiveTrial ? "bg-cream/25" : "bg-cream")}>
            {hasActiveTrial ? 1 : 0}
          </span>
        </span>
      </div>

      <div className="mt-3 flex items-start gap-2 rounded-xl bg-sunshine-200/60 p-3 text-xs font-semibold text-ink-700 ring-1 ring-inset ring-sunshine-400/40">
        <span>ℹ️</span>
        <span>
          Současně může běžet jen <b>jedna adopce</b>. Ostatní žádosti drž v pipeline, dokud se
          zkušebka neuzavře nebo nezruší.
        </span>
      </div>

      {err && <p className="mt-3 text-sm font-semibold text-meadow-700">{err}</p>}

      {applications.length === 0 ? (
        <p className="mt-4 text-sm text-ink-500">Zatím žádné žádosti z webu.</p>
      ) : (
        <ul className="mt-2 divide-y divide-ink-900/8">
          {applications.map((app) => {
            const canStart =
              !readOnly &&
              !hasActiveTrial &&
              (app.status === "approved" || app.status === "contract_signed");
            const canReject =
              !readOnly &&
              ["new", "review", "phone_contact", "in_person_meeting", "approved", "contract_signed"].includes(
                app.status,
              );
            return (
              <li key={app.id} className="py-4">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sand text-lg">
                    🧑
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-ink-900">{app.name}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          APPLICATION_STATUS_PILL[app.status],
                        )}
                      >
                        {APPLICATION_STATUS_LABEL[app.status]}
                      </span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[11px] font-bold",
                          TONE_PILL[app.match.tone],
                        )}
                      >
                        {app.match.score} % shoda
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs font-semibold text-ink-500">
                      📅 {dateLabel(app.createdAt)} · web
                      {app.city ? ` · ${app.city}` : ""}
                    </div>

                    {/* Skríning chipy + červené vlajky */}
                    {app.match.chips.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {app.match.chips.map((c, i) => (
                          <span
                            key={i}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-bold",
                              c.ok
                                ? "bg-fern-50 text-fern-700"
                                : c.severity === "high"
                                  ? "bg-meadow-50 text-meadow-700 ring-1 ring-inset ring-meadow-300/50"
                                  : "bg-sunshine-200 text-ink-700",
                            )}
                          >
                            {c.ok ? "✓" : "⚠"} {c.label}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Akce */}
                    {rejecting === app.id ? (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          autoFocus
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Důvod zamítnutí (do e-mailu)…"
                          className="flex-1 rounded-xl bg-cream-warm px-3 py-1.5 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300"
                        />
                        <button
                          type="button"
                          disabled={pending}
                          onClick={() => doReject(app.id)}
                          className="rounded-pill bg-meadow-500 px-4 py-1.5 text-sm font-semibold text-cream hover:bg-meadow-600 disabled:opacity-50"
                        >
                          Zamítnout + e-mail
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejecting(null)}
                          className="rounded-pill px-3 py-1.5 text-sm font-semibold text-ink-600 hover:bg-cream-warm"
                        >
                          Zpět
                        </button>
                      </div>
                    ) : (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {canStart && (
                          <button
                            type="button"
                            onClick={() => onStart(app)}
                            className="rounded-pill bg-meadow-500 px-3 py-1.5 text-xs font-semibold text-cream hover:bg-meadow-600"
                          >
                            Zahájit adopci
                          </button>
                        )}
                        <Link
                          href={`/admin/applications/${app.id}`}
                          className="rounded-pill border-[1.5px] border-ink-900/15 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-cream-warm"
                        >
                          Spravovat žádost →
                        </Link>
                        {app.phone && (
                          <a
                            href={`tel:${app.phone}`}
                            className="rounded-pill border-[1.5px] border-ink-900/15 px-3 py-1.5 text-xs font-semibold text-ink-700 hover:bg-cream-warm"
                          >
                            📞 Kontaktovat
                          </a>
                        )}
                        {canReject && (
                          <button
                            type="button"
                            onClick={() => {
                              setRejecting(app.id);
                              setReason("");
                            }}
                            className="rounded-pill border-[1.5px] border-meadow-300/60 px-3 py-1.5 text-xs font-semibold text-meadow-700 hover:bg-meadow-50"
                          >
                            Zamítnout + e-mail
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
