"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  XCircle,
} from "lucide-react";

import { ZozioButton } from "@/components/zozio/button";
import type { VerificationStatus } from "@/types/database";

import {
  approveInstitution,
  reactivateInstitution,
  rejectInstitution,
  suspendInstitution,
} from "../actions";

type ReasonMode = "reject" | "suspend";

export function VerificationActions({
  id,
  status,
}: {
  id: string;
  status: VerificationStatus;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<ReasonMode | null>(null);
  const [reason, setReason] = useState("");

  const run = (fn: () => Promise<{ error: string } | { ok: true }>) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if ("error" in r) setError(r.error);
      else {
        setMode(null);
        setReason("");
        router.refresh();
      }
    });
  };

  const reasonCopy =
    mode === "suspend"
      ? {
          label: "Důvod pozastavení",
          placeholder: "Útulek uvidí důvod ve svém dashboardu i e-mailem…",
          confirm: "Potvrdit pozastavení",
        }
      : {
          label: "Důvod zamítnutí",
          placeholder: "Útulek bude moct důvod vidět ve svém dashboardu…",
          confirm: "Potvrdit zamítnutí",
        };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-2xl bg-berry/10 p-3 text-sm text-berry">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!mode ? (
        <div className="flex flex-wrap gap-3">
          {status !== "approved" && status !== "suspended" && (
            <ZozioButton
              variant="meadow"
              size="md"
              onClick={() => run(() => approveInstitution(id))}
              disabled={isPending}
            >
              <CheckCircle2 className="size-4" />
              Schválit útulek
            </ZozioButton>
          )}

          {status === "approved" && (
            <ZozioButton
              variant="outline"
              size="md"
              onClick={() => setMode("suspend")}
              disabled={isPending}
            >
              <PauseCircle className="size-4" />
              Pozastavit
            </ZozioButton>
          )}

          {status === "suspended" && (
            <ZozioButton
              variant="meadow"
              size="md"
              onClick={() => run(() => reactivateInstitution(id))}
              disabled={isPending}
            >
              <PlayCircle className="size-4" />
              Obnovit útulek
            </ZozioButton>
          )}

          {status !== "rejected" && (
            <ZozioButton
              variant="outline"
              size="md"
              onClick={() => setMode("reject")}
              disabled={isPending}
            >
              <XCircle className="size-4" />
              Zamítnout
            </ZozioButton>
          )}
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl bg-berry/5 p-4 ring-1 ring-inset ring-berry/20">
          <label className="block text-sm font-semibold text-ink-900">
            {reasonCopy.label}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="admin-input w-full resize-y"
            placeholder={reasonCopy.placeholder}
          />
          <div className="flex gap-3">
            <ZozioButton
              variant="meadow"
              size="md"
              onClick={() =>
                run(() =>
                  mode === "suspend"
                    ? suspendInstitution(id, reason)
                    : rejectInstitution(id, reason),
                )
              }
              disabled={isPending || !reason.trim()}
            >
              {reasonCopy.confirm}
            </ZozioButton>
            <ZozioButton
              variant="ghost"
              size="md"
              onClick={() => {
                setMode(null);
                setReason("");
                setError(null);
              }}
              disabled={isPending}
            >
              Zrušit
            </ZozioButton>
          </div>
        </div>
      )}
    </div>
  );
}
