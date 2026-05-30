import Link from "next/link";
import { Check, AlertTriangle, ArrowRight, CircleSlash } from "lucide-react";

import {
  evaluateReadiness,
  type ReadinessInput,
} from "@/lib/animal-readiness";
import { cn } from "@/lib/utils";

/**
 * Checklist úplnosti na kartě zvířete. Ukazuje, co ještě chybí k jednotlivým
 * krokům (zveřejnění, adopce). Tvrdé body (severity = hard) krok blokují,
 * měkké jen upozorňují. U každého otevřeného bodu je tlačítko „Vyřešit"
 * vedoucí na příslušnou záložku.
 */
export function ReadinessPanel({
  animalId,
  animal,
}: {
  animalId: string;
  animal: ReadinessInput;
}) {
  const items = evaluateReadiness(animal);
  const open = items.filter((i) => !i.ok);
  const hardOpen = open.filter((i) => i.severity === "hard");
  const softOpen = open.filter((i) => i.severity === "soft");

  const allOk = open.length === 0;

  return (
    <section className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-bold text-ink-900">
          Připravenost
        </h2>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-semibold",
            allOk
              ? "bg-meadow-100 text-meadow-700"
              : hardOpen.length > 0
                ? "bg-peach-100 text-terracotta-600"
                : "bg-sunshine-200 text-ink-700",
          )}
        >
          {allOk
            ? "Vše vyřízeno"
            : hardOpen.length > 0
              ? `${hardOpen.length} blokuje`
              : `${softOpen.length} k doplnění`}
        </span>
      </div>

      <ul className="space-y-2.5">
        {items.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <span className="mt-0.5 shrink-0">
              {item.ok ? (
                <Check className="size-5 text-meadow-600" />
              ) : item.severity === "hard" ? (
                <CircleSlash className="size-5 text-terracotta-500" />
              ) : (
                <AlertTriangle className="size-5 text-sunshine-500" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "text-sm font-semibold",
                  item.ok ? "text-ink-500 line-through" : "text-ink-900",
                )}
              >
                {item.label}
                {!item.ok && item.severity === "hard" && (
                  <span className="ml-2 align-middle text-xs font-semibold text-terracotta-600">
                    blokuje
                  </span>
                )}
              </p>
              {!item.ok && (
                <p className="mt-0.5 text-xs text-ink-500">{item.hint}</p>
              )}
            </div>
            {!item.ok && item.resolve && (
              <Link
                href={`/admin/animals/${animalId}/${item.resolve}`}
                className="inline-flex shrink-0 items-center gap-1 self-center rounded-pill bg-cream-warm px-3 py-1.5 text-xs font-semibold text-ink-700 ring-1 ring-ink-900/10 hover:bg-ink-900/8"
              >
                Vyřešit <ArrowRight className="size-3.5" />
              </Link>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
