"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import {
  addMunicipalities,
  loadOwnershipForMap,
  removeMunicipality,
} from "./municipalities-actions";

type ObecProps = { kod: number; nazev: string; okres: number; state: "mine" | "other" | "free" };
type ObecFeature = GeoJSON.Feature<GeoJSON.Geometry, ObecProps>;

const BLANK_STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: "bg", type: "background", paint: { "background-color": "#FDF6EC" } }],
};

export function AdminMapPicker({ onChanged }: { onChanged?: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const featuresRef = useRef<ObecFeature[]>([]);
  const mineRef = useRef<Set<number>>(new Set());
  const otherRef = useRef<Set<number>>(new Set());
  const busyRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  function refreshSource() {
    const map = mapRef.current;
    if (!map) return;
    const src = map.getSource("obce") as maplibregl.GeoJSONSource | undefined;
    if (src) src.setData({ type: "FeatureCollection", features: featuresRef.current });
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BLANK_STYLE,
      center: [15.4, 49.82],
      zoom: 6.7,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");

    map.on("load", async () => {
      try {
        const [own, gjRes] = await Promise.all([
          loadOwnershipForMap(),
          fetch("/geo/obce-cz.min.geojson").then((r) => r.json() as Promise<GeoJSON.FeatureCollection>),
        ]);
        mineRef.current = new Set(own.mineKods);
        otherRef.current = new Set(own.otherKods);
        setCount(own.mineKods.length);

        const feats = gjRes.features as ObecFeature[];
        for (const f of feats) {
          const kod = f.properties.kod;
          f.properties.state = mineRef.current.has(kod)
            ? "mine"
            : otherRef.current.has(kod)
              ? "other"
              : "free";
        }
        featuresRef.current = feats;

        map.addSource("obce", { type: "geojson", data: { type: "FeatureCollection", features: feats } });
        map.addLayer({
          id: "obce-fill",
          type: "fill",
          source: "obce",
          paint: {
            "fill-color": [
              "match",
              ["get", "state"],
              "mine",
              "#E8634A",
              "other",
              "#9B5E35",
              "#F5E6D3",
            ],
            "fill-opacity": [
              "match",
              ["get", "state"],
              "mine",
              0.5,
              "other",
              0.35,
              0.12,
            ],
          },
        });
        map.addLayer({
          id: "obce-line",
          type: "line",
          source: "obce",
          paint: { "line-color": "#FFFFFF", "line-width": 0.5 },
        });

        map.on("click", "obce-fill", onObecClick);
        map.on("mouseenter", "obce-fill", () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", "obce-fill", () => (map.getCanvas().style.cursor = ""));
        setReady(true);
      } catch {
        setReady(true);
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function onObecClick(e: maplibregl.MapLayerMouseEvent) {
    if (busyRef.current) return;
    const feat = e.features?.[0];
    if (!feat) return;
    const p = feat.properties as ObecProps;
    const kod = Number(p.kod);
    const local = featuresRef.current.find((f) => f.properties.kod === kod);
    if (!local) return;

    setMsg(null);
    if (local.properties.state === "other") {
      setMsg(`Obec ${p.nazev} už pokrývá jiný útulek.`);
      return;
    }

    busyRef.current = true;
    if (local.properties.state === "mine") {
      const res = await removeMunicipality(kod);
      if ("ok" in res) {
        local.properties.state = "free";
        mineRef.current.delete(kod);
      }
    } else {
      const res = await addMunicipalities([
        { kod, nazev: String(p.nazev), okres: p.okres ? Number(p.okres) : null },
      ]);
      if ("ok" in res && res.conflicts.length === 0) {
        local.properties.state = "mine";
        mineRef.current.add(kod);
      } else if ("ok" in res) {
        setMsg(`Obec ${p.nazev} mezitím zabral jiný útulek.`);
      }
    }
    busyRef.current = false;
    setCount(mineRef.current.size);
    refreshSource();
    onChanged?.();
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-[4px] bg-terracotta-500/60" /> Vaše obce ({count})
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-[4px] bg-[#9B5E35]/50" /> Jiný útulek
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-[4px] bg-sand" /> Volné — klikni pro přidání
        </span>
      </div>
      {msg && (
        <div className="mb-2 rounded-xl bg-peach-100 px-3 py-2 text-xs font-semibold text-terracotta-600">
          {msg}
        </div>
      )}
      <div className="relative overflow-hidden rounded-2xl ring-1 ring-ink-900/8">
        <div ref={containerRef} className="h-[420px] w-full" />
        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center bg-cream/60 text-sm font-semibold text-ink-500">
            Načítám mapu…
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-ink-400">
        Klikni na obec pro přidání/odebrání ze spádové oblasti. Změny se ukládají hned.
      </p>
    </div>
  );
}
