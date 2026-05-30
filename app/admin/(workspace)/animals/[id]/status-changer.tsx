"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Lock } from "lucide-react";

import {
  ADOPTION_OUTCOME_STATUSES,
  ADOPTION_STATUS_LABEL,
  ADOPTION_STATUS_PILL,
  DERIVED_ADOPTION_STATUSES,
  DERIVED_STATUS_SOURCE,
  MANUAL_ADOPTION_STATUSES,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  AdoptionStatus,
  AnimalLegalStatus,
  AnimalSupervisionStatus,
} from "@/types/database";

import { changeAnimalStatus } from "../actions";

export function StatusChanger({
  animalId,
  current,
  legalStatus,
  supervisionStatus,
  canOverride = false,
}: {
  animalId: string;
  current: AdoptionStatus;
  legalStatus?: AnimalLegalStatus;
  supervisionStatus?: AnimalSupervisionStatus;
  /** Owner/admin smí přebít tvrdou blokaci připravenosti. */
  canOverride?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<AdoptionStatus | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Když server vrátí blokaci připravenosti, nabídneme owner/adminovi přebití.
  const [blocked, setBlocked] = useState<{
    status: AdoptionStatus;
    message: string;
  } | null>(null);
  const [override, setOverride] = useState("");
  const [isPending, startTransition] = useTransition();

  const isDerived = DERIVED_ADOPTION_STATUSES.includes(current);
  const needsNote = target ? ADOPTION_OUTCOME_STATUSES.includes(target) : false;

  const inQuarantine =
    supervisionStatus === "quarantine" || supervisionStatus === "isolation";
  const inProtection = legalStatus === "in_protection";

  function reset() {
    setOpen(false);
    setTarget(null);
    setNote("");
    setError(null);
    setBlocked(null);
    setOverride("");
  }

  function pick(status: AdoptionStatus) {
    if (status === current) {
      reset();
      return;
    }
    setError(null);
    if (ADOPTION_OUTCOME_STATUSES.includes(status)) {
      setTarget(status); // vyžádá poznámku v druhém kroku
    } else {
      submit(status);
    }
  }

  function submit(
    status: AdoptionStatus,
    withNote?: string,
    overrideReason?: string,
  ) {
    startTransition(async () => {
      const res = await changeAnimalStatus(
        animalId,
        status,
        withNote,
        overrideReason,
      );
      if ("error" in res) {
        // Tvrdá blokace připravenosti — owner/admin může přebít s důvodem.
        if (
          !overrideReason &&
          canOverride &&
          /pro přebití doplň důvod/i.test(res.error)
        ) {
          setBlocked({ status, message: res.error });
          setError(null);
          return;
        }
        setError(res.error);
        return;
      }
      reset();
      router.refresh();
    });
  }

  // Odvozený stav (foster/reserved/adopted/returned/deceased) řídí strukturovaný
  // tok — ručně se nemění. Ukážeme zamčený štítek s odkazem na záložku.
  if (isDerived) {
    const src = DERIVED_STATUS_SOURCE[current];
    return (
      <div className="inline-flex items-center gap-2 rounded-pill bg-cream px-4 py-2 text-sm ring-1 ring-ink-900/10">
        <Lock className="size-3.5 text-ink-400" />
        <span
          className={cn(
            "rounded-full px-2.5 py-0.5 text-xs font-semibold",
            ADOPTION_STATUS_PILL[current],
          )}
        >
          {ADOPTION_STATUS_LABEL[current]}
        </span>
        {src && (
          <span className="text-xs text-ink-500">řídí záložka {src}</span>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-pill bg-cream px-4 py-2 text-sm font-semibold text-ink-700 ring-1 ring-ink-900/10 hover:bg-cream-warm"
      >
        Změnit stav <ChevronDown className="size-4" />
      </button>

      {open && (
        <>
          {/* klik mimo zavře */}
          <div className="fixed inset-0 z-10" onClick={reset} />
          <div className="absolute right-0 z-20 mt-2 w-72 rounded-2xl bg-cream p-2 shadow-lg ring-1 ring-ink-900/10">
            {blocked ? (
              <div className="space-y-3 p-2">
                <div className="rounded-xl bg-peach-100 p-3 text-xs text-ink-700 ring-1 ring-inset ring-peach-300/60">
                  {blocked.message}
                </div>
                <p className="text-sm font-semibold text-ink-900">
                  Přebít blokaci (majitel/admin)
                </p>
                <textarea
                  autoFocus
                  rows={3}
                  value={override}
                  onChange={(e) => setOverride(e.target.value)}
                  placeholder="Důvod přebití — zapíše se do historie…"
                  className="w-full rounded-xl bg-cream-warm px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300"
                />
                {error && <p className="text-xs text-berry">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-pill px-3 py-1.5 text-sm font-semibold text-ink-600 hover:bg-cream-warm"
                  >
                    Zrušit
                  </button>
                  <button
                    type="button"
                    disabled={isPending || !override.trim()}
                    onClick={() =>
                      submit(blocked.status, note || undefined, override)
                    }
                    className="rounded-pill bg-terracotta-500 px-4 py-1.5 text-sm font-semibold text-cream hover:bg-terracotta-600 disabled:opacity-50"
                  >
                    {isPending ? "Ukládám…" : "Přebít a pokračovat"}
                  </button>
                </div>
              </div>
            ) : target && needsNote ? (
              <div className="space-y-3 p-2">
                <p className="text-sm font-semibold text-ink-900">
                  Změnit na „{ADOPTION_STATUS_LABEL[target]}"
                </p>
                <textarea
                  autoFocus
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Poznámka (povinné u výstupního stavu)…"
                  className="w-full rounded-xl bg-cream-warm px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-300"
                />
                {error && <p className="text-xs text-berry">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-pill px-3 py-1.5 text-sm font-semibold text-ink-600 hover:bg-cream-warm"
                  >
                    Zrušit
                  </button>
                  <button
                    type="button"
                    disabled={isPending || !note.trim()}
                    onClick={() => submit(target, note)}
                    className="rounded-pill bg-ink-900 px-4 py-1.5 text-sm font-semibold text-cream hover:bg-ink-800 disabled:opacity-50"
                  >
                    {isPending ? "Ukládám…" : "Potvrdit"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                {error && (
                  <p className="px-3 py-2 text-xs text-berry">{error}</p>
                )}
                {(inQuarantine || inProtection) && (
                  <p className="px-3 py-2 text-xs text-ink-500">
                    {inQuarantine &&
                      "V karanténě/izolaci se zvíře na web nezveřejní, dokud ho nepustíš. "}
                    {inProtection &&
                      "V ochranné lhůtě nelze převést vlastnictví."}
                  </p>
                )}
                {MANUAL_ADOPTION_STATUSES.map((status) => {
                  const blocked = status === "transferred" && inProtection;
                  return (
                    <button
                      key={status}
                      type="button"
                      disabled={isPending || blocked}
                      onClick={() => pick(status)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-cream-warm disabled:opacity-40",
                        status === current && "font-semibold",
                      )}
                    >
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          ADOPTION_STATUS_PILL[status],
                        )}
                      >
                        {ADOPTION_STATUS_LABEL[status]}
                      </span>
                      {status === current && (
                        <Check className="size-4 text-meadow-600" />
                      )}
                    </button>
                  );
                })}
                <p className="mt-1 px-3 py-2 text-xs text-ink-400">
                  Rezervaci, pěstouna, adopci a úhyn zakládej v příslušné
                  záložce.
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
