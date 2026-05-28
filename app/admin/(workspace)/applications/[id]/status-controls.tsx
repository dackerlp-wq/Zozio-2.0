"use client";

import { useState, useTransition } from "react";
import { Check, X } from "lucide-react";

import { ZozioButton } from "@/components/zozio/button";
import {
  APPLICATION_STATUS_FLOW,
  APPLICATION_STATUS_LABEL,
} from "@/lib/format";
import type { ApplicationStatus } from "@/types/database";

import { setApplicationStatus } from "../actions";

export function StatusControls({
  id,
  status,
}: {
  id: string;
  status: ApplicationStatus;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const isRejected = status === "rejected";
  const currentIndex = APPLICATION_STATUS_FLOW.indexOf(status);

  function update(next: ApplicationStatus, note?: string) {
    setError(null);
    startTransition(async () => {
      const res = await setApplicationStatus(id, next, note);
      if ("error" in res) setError(res.error);
      else setRejecting(false);
    });
  }

  return (
    <div className="mt-4 space-y-4">
      {/* Workflow kroky */}
      <div className="flex flex-wrap gap-2">
        {APPLICATION_STATUS_FLOW.map((s, i) => {
          const done = !isRejected && i < currentIndex;
          const active = !isRejected && i === currentIndex;
          return (
            <button
              key={s}
              type="button"
              disabled={isPending || active}
              onClick={() => update(s)}
              className={
                active
                  ? "inline-flex items-center gap-1.5 rounded-full bg-meadow-500 px-3.5 py-1.5 text-sm font-semibold text-cream"
                  : done
                    ? "inline-flex items-center gap-1.5 rounded-full bg-meadow-100 px-3.5 py-1.5 text-sm font-semibold text-meadow-700 hover:bg-meadow-200"
                    : "inline-flex items-center gap-1.5 rounded-full bg-cream-warm px-3.5 py-1.5 text-sm font-semibold text-ink-600 ring-1 ring-ink-900/8 hover:bg-sage-100 disabled:opacity-50"
              }
            >
              {done && <Check className="size-3.5" />}
              {APPLICATION_STATUS_LABEL[s]}
            </button>
          );
        })}
      </div>

      {/* Zamítnutí */}
      {isRejected ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-ink-900/5 px-4 py-3">
          <span className="text-sm font-semibold text-ink-600">
            Žádost zamítnuta
          </span>
          <button
            type="button"
            disabled={isPending}
            onClick={() => update("new")}
            className="text-sm font-semibold text-meadow-700 hover:underline disabled:opacity-50"
          >
            Obnovit
          </button>
        </div>
      ) : rejecting ? (
        <div className="space-y-2 rounded-2xl bg-terracotta-500/5 p-4">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Důvod zamítnutí (volitelné, neuvidí žadatel pokud nechceš)…"
            className="w-full rounded-xl border border-ink-900/15 bg-cream px-3 py-2 text-sm outline-none focus-visible:border-terracotta-500"
          />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() => update("rejected", reason)}
              className="rounded-full bg-terracotta-500 px-4 py-1.5 text-sm font-semibold text-cream disabled:opacity-50"
            >
              {isPending ? "Zamítám…" : "Potvrdit zamítnutí"}
            </button>
            <button
              type="button"
              onClick={() => setRejecting(false)}
              className="rounded-full bg-cream-warm px-4 py-1.5 text-sm font-semibold text-ink-600"
            >
              Zrušit
            </button>
          </div>
        </div>
      ) : (
        <ZozioButton
          variant="outline"
          size="sm"
          onClick={() => setRejecting(true)}
          className="text-terracotta-600"
        >
          <X /> Zamítnout žádost
        </ZozioButton>
      )}

      {error && (
        <p className="text-sm font-medium text-terracotta-600">{error}</p>
      )}
    </div>
  );
}
