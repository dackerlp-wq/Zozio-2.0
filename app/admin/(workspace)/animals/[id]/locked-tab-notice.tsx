import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";

import { TAB_LABEL } from "@/lib/animal-tabs-layout";

/**
 * Náhrada obsahu zamčené záložky. Vysvětlí důvod a nabídne tlačítko
 * na záložku, kde se zámek vyřeší. Žádný editovatelný obsah.
 */
export function LockedTabNotice({
  animalId,
  reason,
  unlockTab,
}: {
  animalId: string;
  reason: string;
  unlockTab?: string;
}) {
  const label = unlockTab ? (TAB_LABEL[unlockTab] ?? "příslušnou záložku") : null;
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-cream p-10 text-center ring-1 ring-ink-900/8">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-sunshine-200">
        <Lock className="size-6 text-sunshine-600" />
      </div>
      <h2 className="font-display text-xl font-bold text-ink-900">
        Záložka je zatím zamčená
      </h2>
      <p className="mt-2 max-w-md text-sm text-ink-600">{reason}</p>
      {unlockTab && (
        <Link
          href={`/admin/animals/${animalId}/${unlockTab}`}
          className="mt-5 inline-flex items-center gap-1.5 rounded-pill bg-ink-900 px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink-800"
        >
          Přejít na {label} <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
