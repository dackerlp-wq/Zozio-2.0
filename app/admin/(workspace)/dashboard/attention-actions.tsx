"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { changeAnimalStatus } from "../animals/actions";
import { setLegalStatus } from "../animals/[id]/intake-actions";

export type AttentionAction = "publish" | "to_shelter" | "found_listing" | "end_supervision";

export interface AttentionItem {
  animalId: string;
  icon: string;
  title: string;
  detail: string;
  action: AttentionAction;
  actionLabel: string;
}

export function AttentionList({ items }: { items: AttentionItem[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  function run(fn: () => Promise<{ error: string } | { ok: true }>) {
    setErr(null);
    startTransition(async () => {
      const res = await fn();
      if ("error" in res) setErr(res.error);
      else router.refresh();
    });
  }

  return (
    <div>
      {err && <p className="mb-2 text-sm font-semibold text-meadow-700">{err}</p>}
      {items.map((it) => (
        <div
          key={`${it.animalId}-${it.action}`}
          className="flex flex-wrap items-center gap-3 border-b border-ink-900/5 py-3 last:border-none"
        >
          <span className="w-6 shrink-0 text-center text-lg">{it.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink-900">{it.title}</p>
            <p className="text-xs text-ink-500">{it.detail}</p>
          </div>
          {it.action === "found_listing" || it.action === "end_supervision" ? (
            <Link
              href={
                it.action === "found_listing"
                  ? `/admin/animals/${it.animalId}/prijem`
                  : `/admin/animals/${it.animalId}/karantena`
              }
              className="shrink-0 rounded-pill border-[1.5px] border-meadow-300/60 px-3 py-1.5 text-xs font-bold text-meadow-700 hover:bg-meadow-50"
            >
              {it.actionLabel}
            </Link>
          ) : (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() =>
                  it.action === "publish"
                    ? changeAnimalStatus(it.animalId, "available")
                    : setLegalStatus(it.animalId, "shelter_owned"),
                )
              }
              className={cn(
                "shrink-0 rounded-pill border-[1.5px] border-meadow-500 px-3 py-1.5 text-xs font-bold text-meadow-600 hover:bg-meadow-50 disabled:opacity-50",
              )}
            >
              {it.actionLabel}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
