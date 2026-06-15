"use client";

import dynamic from "next/dynamic";

import type { MapData } from "@/lib/municipalities";

const MapExplorer = dynamic(() => import("./map-explorer").then((m) => m.MapExplorer), {
  ssr: false,
  loading: () => (
    <div className="h-[460px] w-full animate-pulse rounded-3xl bg-cream-warm sm:h-[560px]" />
  ),
});

export function MapExplorerLoader({ data }: { data: MapData }) {
  return <MapExplorer data={data} />;
}
