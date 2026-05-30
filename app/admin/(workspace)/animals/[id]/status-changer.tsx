"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";

import {
  ADOPTION_OUTCOME_STATUSES,
  ADOPTION_STATUS_FLOW,
  ADOPTION_STATUS_LABEL,
  ADOPTION_STATUS_PILL,
} from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AdoptionStatus } from "@/types/database";

import { changeAnimalStatus } from "../actions";

export function StatusChanger({
  animalId,
  current,
}: {
  animalId: string;
  current: AdoptionStatus;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<AdoptionStatus | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const needsNote = target ? ADOPTION_OUTCOME_STATUSES.includes(target) : false;

  function reset() {
    setOpen(false);
    setTarget(null);
    setNote("");
    setError(null);
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

  function submit(status: AdoptionStatus, withNote?: string) {
    startTransition(async () => {
      const res = await changeAnimalStatus(animalId, status, withNote);
      if ("error" in res) {
        setError(res.error);
        return;
      }
      reset();
      router.refresh();
    });
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
            {target && needsNote ? (
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
                  className="w-full rounded-xl bg-cream-warm px-3 py-2 text-sm text-ink-900 ring-1 ring-ink-900/10 focus:outline-none focus:ring-2 focus:ring-meadow-400"
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
              <div className="max-h-80 overflow-y-auto">
                {error && (
                  <p className="px-3 py-2 text-xs text-berry">{error}</p>
                )}
                {ADOPTION_STATUS_FLOW.map((status) => (
                  <button
                    key={status}
                    type="button"
                    disabled={isPending}
                    onClick={() => pick(status)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm hover:bg-cream-warm disabled:opacity-50",
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
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
