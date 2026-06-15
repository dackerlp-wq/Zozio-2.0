import { loadMapData } from "@/lib/municipalities";

import { MapExplorerLoader } from "./map-explorer-loader";

export const revalidate = 300;

export const metadata = {
  title: "Mapa útulků a spádových oblastí · Zozio",
  description:
    "Najdi útulek, který pokrývá tvou obec. Mapa útulků v ČR a jejich spádových oblastí podle hranic obcí.",
  openGraph: {
    title: "Mapa útulků · Zozio",
    description: "Útulky a jejich spádové oblasti podle hranic obcí.",
    type: "website",
  },
};

export default async function MapaPage() {
  const data = await loadMapData();

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6">
      <div className="font-mono text-xs font-bold uppercase tracking-wider text-terracotta-600">
        Mapa
      </div>
      <h1 className="mb-5 mt-1 font-display text-3xl font-bold tracking-tight text-ink-900 md:text-4xl">
        Mapa útulků a jejich spádových oblastí
      </h1>
      <MapExplorerLoader data={data} />
    </div>
  );
}
