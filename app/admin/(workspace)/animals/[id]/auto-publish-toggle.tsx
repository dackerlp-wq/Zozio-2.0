"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { setAutoPublish } from "../actions";

/** Přepínač automatického zveřejnění (po splnění připravenosti). */
export function AutoPublishToggle({
  animalId,
  initial,
}: {
  animalId: string;
  initial: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next); // optimisticky
    startTransition(async () => {
      const res = await setAutoPublish(animalId, next);
      if ("error" in res) setOn(!next);
      else router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-ink-700 disabled:opacity-60"
      aria-pressed={on}
    >
      <span
        className={cn(
          "relative inline-flex h-5 w-9 items-center rounded-pill transition-colors",
          on ? "bg-sage-500" : "bg-ink-900/15",
        )}
      >
        <span
          className={cn(
            "inline-block size-4 rounded-full bg-cream shadow transition-transform",
            on ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </span>
      Automaticky zveřejnit, až bude připravené
    </button>
  );
}
