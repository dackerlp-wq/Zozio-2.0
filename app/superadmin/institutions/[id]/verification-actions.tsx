"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, XCircle } from "lucide-react";

import { ZozioButton } from "@/components/zozio/button";
import type { VerificationStatus } from "@/types/database";

import { approveInstitution, rejectInstitution } from "../actions";

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
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");

  const handleApprove = () => {
    setError(null);
    startTransition(async () => {
      const r = await approveInstitution(id);
      if ("error" in r) setError(r.error);
      else router.refresh();
    });
  };

  const handleReject = () => {
    setError(null);
    startTransition(async () => {
      const r = await rejectInstitution(id, reason);
      if ("error" in r) setError(r.error);
      else {
        setRejecting(false);
        setReason("");
        router.refresh();
      }
    });
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 rounded-2xl bg-berry/10 p-3 text-sm text-berry">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!rejecting ? (
        <div className="flex flex-wrap gap-3">
          {status !== "approved" && (
            <ZozioButton
              variant="meadow"
              size="md"
              onClick={handleApprove}
              disabled={isPending}
            >
              <CheckCircle2 className="size-4" />
              Schválit útulek
            </ZozioButton>
          )}
          {status !== "rejected" && (
            <ZozioButton
              variant="outline"
              size="md"
              onClick={() => setRejecting(true)}
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
            Důvod zamítnutí
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="admin-input w-full resize-y"
            placeholder="Útulek bude moct důvod vidět ve svém dashboardu…"
          />
          <div className="flex gap-3">
            <ZozioButton
              variant="meadow"
              size="md"
              onClick={handleReject}
              disabled={isPending || !reason.trim()}
            >
              Potvrdit zamítnutí
            </ZozioButton>
            <ZozioButton
              variant="ghost"
              size="md"
              onClick={() => {
                setRejecting(false);
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
