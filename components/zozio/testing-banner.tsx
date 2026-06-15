import Link from "next/link";

import { remainingSpots } from "@/lib/plans";
import { loadShelterTestingMode } from "@/lib/platform-settings";

const REGISTER_HREF = "/auth/register?role=institution";

/**
 * Pruh „testovací režim" nad navigací — nabídka pro prvních N útulků.
 * Konfigurovatelný v superadminu; po naplnění míst nebo vypnutí se skryje.
 */
export async function TestingBanner() {
  const testing = await loadShelterTestingMode();
  const remaining = remainingSpots(testing);
  if (!testing.enabled || remaining <= 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-ink-900 px-5 py-3 text-center text-sm font-semibold text-cream/90">
      <span className="rounded-pill bg-sunshine-400 px-3 py-1 text-xs font-extrabold text-ink-900">
        🚧 Testovací režim
      </span>
      <span>
        Prvních <b className="text-cream">{testing.total_spots} útulků</b>, které
        se zapojí do testovací fáze, získá nejvyšší tarif{" "}
        <b className="text-cream">Komplet zdarma na rok</b> od ukončení testování
        — zbývá <b className="text-sunshine-400">{remaining}</b>.
      </span>
      <Link
        href={REGISTER_HREF}
        className="font-extrabold text-sunshine-400 hover:underline"
      >
        Zapojit se →
      </Link>
    </div>
  );
}
