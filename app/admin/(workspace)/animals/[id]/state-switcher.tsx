"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Lock } from "lucide-react";

import {
  ADOPTION_OUTCOME_STATUSES,
  ADOPTION_STATUS_HELP,
  ADOPTION_STATUS_LABEL,
  DERIVED_ADOPTION_STATUSES,
  DERIVED_STATUS_SOURCE,
  MANUAL_ADOPTION_STATUSES,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdoptionStatus } from "@/types/database";

import { changeAnimalStatus } from "../actions";

const BLOCKED_DURING_PROTECTION: AdoptionStatus[] = ["available", "transferred"];

export function StateSwitcher({
  animalId,
  current,
  inProtection,
  canOverride,
  publishBlockerText,
}: {
  animalId: string;
  current: AdoptionStatus;
  inProtection: boolean;
  canOverride: boolean;
  /** Labely tvrdých bodů blokujících zveřejnění (mimo ochrannou lhůtu). */
  publishBlockerText: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<AdoptionStatus | null>(null);
  const [note, setNote] = useState("");
  const [overrideFor, setOverrideFor] = useState<AdoptionStatus | null>(null);
  const [override, setOverride] = useState("");

  const publishBlocked = publishBlockerText.length > 0;

  function reset() {
    setNoteFor(null);
    setNote("");
    setOverrideFor(null);
    setOverride("");
    setError(null);
  }

  function submit(status: AdoptionStatus, withNote?: string, ovr?: string) {
    setError(null);
    startTransition(async () => {
      const res = await changeAnimalStatus(animalId, status, withNote, ovr);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      reset();
      router.refresh();
    });
  }

  function pick(status: AdoptionStatus) {
    if (status === current) return;
    // Zveřejnění blokované readiness bodem → override panel (owner/admin).
    if (status === "available" && publishBlocked && !inProtection) {
      if (canOverride) {
        setOverrideFor(status);
        return;
      }
      setError(`Zvíře nelze zveřejnit: ${publishBlockerText}. Přebití může provést jen majitel nebo admin.`);
      return;
    }
    // Výstupní stav → povinná poznámka.
    if (ADOPTION_OUTCOME_STATUSES.includes(status)) {
      setNoteFor(status);
      return;
    }
    submit(status);
  }

  return (
    <div className="space-y-4">
      {/* Ruční stavy */}
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">
          Ruční stavy
        </p>
        <div className="flex flex-wrap gap-2">
          {MANUAL_ADOPTION_STATUSES.map((status) => {
            const isCurrent = status === current;
            const protectionBlocked =
              inProtection && BLOCKED_DURING_PROTECTION.includes(status);
            const readinessBlocked =
              status === "available" && publishBlocked && !inProtection;
            const disabled =
              isPending || protectionBlocked || (readinessBlocked && !canOverride);
            const why = protectionBlocked
              ? "Nelze během ochranné lhůty"
              : readinessBlocked
                ? `Chybí: ${publishBlockerText}`
                : undefined;

            return (
              <button
                key={status}
                type="button"
                title={why}
                disabled={disabled}
                onClick={() => pick(status)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-pill border-[1.5px] px-4 py-2 text-sm font-semibold transition-colors",
                  isCurrent
                    ? "border-meadow-500 bg-meadow-500 text-cream"
                    : disabled
                      ? "cursor-not-allowed border-transparent bg-cream-warm text-ink-400 opacity-60"
                      : "border-ink-900/15 bg-cream text-ink-700 hover:border-meadow-500 hover:text-meadow-700",
                )}
              >
                {isCurrent && <Check className="size-3.5" />}
                {ADOPTION_STATUS_LABEL[status]}
                {readinessBlocked && canOverride && (
                  <span className="text-[10px] font-semibold opacity-70">
                    přebít
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {!inProtection && (
          <p className="mt-2 text-xs text-ink-400">
            {ADOPTION_STATUS_HELP[current] ?? "Vyber nový ruční stav."}
          </p>
        )}
      </div>

      {/* Odvozené stavy — zamčené */}
      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">
          Odvozené stavy · řídí záložky
        </p>
        <div className="flex flex-wrap gap-2">
          {DERIVED_ADOPTION_STATUSES.map((status) => {
            const isCurrent = status === current;
            return (
              <span
                key={status}
                title={`Nastav přes záložku ${DERIVED_STATUS_SOURCE[status] ?? "—"}`}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-pill border-[1.5px] border-dashed px-4 py-2 text-sm font-semibold",
                  isCurrent
                    ? "border-ink-900/30 bg-cream-warm text-ink-700"
                    : "border-ink-900/15 bg-cream text-ink-400",
                )}
              >
                <Lock className="size-3.5" />
                {ADOPTION_STATUS_LABEL[status]}
                <span className="text-[10px] font-semibold opacity-70">
                  {DERIVED_STATUS_SOURCE[status]}
                </span>
              </span>
            );
          })}
        </div>
      </div>

      {/* Poznámka u výstupního stavu */}
      {noteFor && (
        <div className="space-y-2 rounded-lg bg-cream-warm p-4">
          <p className="text-sm font-semibold text-ink-900">
            Změnit na „{ADOPTION_STATUS_LABEL[noteFor]}" — doplň poznámku
          </p>
          <textarea
            autoFocus
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Poznámka (povinná u výstupního stavu)…"
            className="w-full rounded-md border border-ink-900/15 bg-cream px-3 py-2 text-sm outline-none focus-visible:border-meadow-500"
          />
          {error && <p className="text-xs text-meadow-700">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending || !note.trim()}
              onClick={() => submit(noteFor, note)}
              className="rounded-pill bg-ink-900 px-4 py-1.5 text-sm font-semibold text-cream disabled:opacity-50"
            >
              {isPending ? "Ukládám…" : "Potvrdit"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-pill px-4 py-1.5 text-sm font-semibold text-ink-600 hover:bg-cream-warm"
            >
              Zrušit
            </button>
          </div>
        </div>
      )}

      {/* Override blokace zveřejnění */}
      {overrideFor && (
        <div className="space-y-2 rounded-lg bg-meadow-50 p-4 ring-1 ring-inset ring-meadow-300/50">
          <p className="text-sm font-semibold text-ink-900">
            Přebít blokaci zveřejnění (majitel/admin)
          </p>
          <p className="text-xs text-ink-600">Chybí: {publishBlockerText}</p>
          <textarea
            autoFocus
            rows={2}
            value={override}
            onChange={(e) => setOverride(e.target.value)}
            placeholder="Důvod přebití — zapíše se do historie…"
            className="w-full rounded-md border border-ink-900/15 bg-cream px-3 py-2 text-sm outline-none focus-visible:border-meadow-500"
          />
          {error && <p className="text-xs text-meadow-700">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending || !override.trim()}
              onClick={() => submit(overrideFor, undefined, override)}
              className="rounded-pill bg-meadow-500 px-4 py-1.5 text-sm font-semibold text-cream disabled:opacity-50"
            >
              {isPending ? "Ukládám…" : "Přebít a zveřejnit"}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-pill px-4 py-1.5 text-sm font-semibold text-ink-600 hover:bg-cream"
            >
              Zrušit
            </button>
          </div>
        </div>
      )}

      {error && !noteFor && !overrideFor && (
        <p className="text-sm font-medium text-meadow-700">{error}</p>
      )}
    </div>
  );
}
