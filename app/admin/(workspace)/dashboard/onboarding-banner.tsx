"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export interface OnboardingStep {
  label: string;
  done: boolean;
  href: string;
}

export function OnboardingBanner({ steps }: { steps: OnboardingStep[] }) {
  const [dismissed, setDismissed] = useState(true);

  // Zavření si pamatujeme lokálně; znovu se ukáže jen po vyčištění.
  useEffect(() => {
    setDismissed(localStorage.getItem("zozio-onboarding-dismissed") === "1");
  }, []);

  if (dismissed || steps.every((s) => s.done)) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-meadow-50 p-4 ring-1 ring-inset ring-meadow-300/40">
      <span className="font-display font-bold text-meadow-700">🚀 Dokonči nastavení</span>
      <div className="flex flex-1 flex-wrap gap-2">
        {steps.map((s) =>
          s.done ? (
            <span
              key={s.label}
              className="rounded-pill bg-cream px-3 py-1 text-xs font-bold text-fern-700"
            >
              ✓ {s.label}
            </span>
          ) : (
            <Link
              key={s.label}
              href={s.href}
              className={cn(
                "rounded-pill bg-cream px-3 py-1 text-xs font-bold text-meadow-700 ring-1 ring-inset ring-meadow-500",
              )}
            >
              ⬜ {s.label}
            </Link>
          ),
        )}
      </div>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem("zozio-onboarding-dismissed", "1");
          setDismissed(true);
        }}
        className="rounded-full p-1 text-meadow-700 hover:bg-meadow-100"
        aria-label="Zavřít"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
