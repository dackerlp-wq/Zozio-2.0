import { loadShelterList } from "@/lib/shelters";

import { ShelterDirectory } from "./shelter-directory";

export const revalidate = 120;

export const metadata = {
  title: "Útulky — Najdi útulek u tebe · Zozio",
  description:
    "Ověřené útulky v Česku a na Slovensku. Najdi útulek ve svém okolí a podpoř zvířata, která hledají nový domov.",
  openGraph: {
    title: "Útulky na Zozio",
    description: "Ověřené útulky v Česku a na Slovensku.",
    type: "website",
  },
};

export default async function SheltersPage() {
  const { shelters, regions, obecOwner } = await loadShelterList();

  return (
    <>
      {/* Hlavička */}
      <section className="bg-gradient-to-br from-cream via-cream-warm to-peach-100/40">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 md:py-16">
          <div className="font-mono text-xs font-bold uppercase tracking-wider text-terracotta-600">
            Síť útulků
          </div>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-ink-900 md:text-5xl">
            Najdi útulek u tebe
          </h1>
          <p className="mt-2 text-lg font-semibold text-ink-600">
            Ověřené útulky v Česku a na Slovensku.
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <ShelterDirectory shelters={shelters} regions={regions} obecOwner={obecOwner} />
      </div>
    </>
  );
}
