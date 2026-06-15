// Stáhne polygony obcí ČR z ČÚZK RÚIAN (autoritativní, RÚIAN kód) jako GeoJSON
// ve WGS84, server-side generalizované, a uloží do public/geo/obce-cz.geojson.
// Spuštění:  node scripts/fetch-obce.mjs
// Pak zjednodušit:  npx mapshaper public/geo/obce-cz.geojson -simplify 12% keep-shapes -o format=topojson public/geo/obce-cz.topojson
import { writeFileSync, mkdirSync } from "node:fs";

const BASE =
  "https://ags.cuzk.cz/arcgis/rest/services/RUIAN/Prohlizeci_sluzba_nad_daty_RUIAN/MapServer/12/query";
const PAGE = 400;
// ~0.0007° ≈ 70 m generalizace na serveru — výrazně menší soubor, hranice drží.
const OFFSET = 0.0007;

async function fetchPage(offset) {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "kod,nazev,okres,nutslau",
    outSR: "4326",
    geometryPrecision: "5",
    maxAllowableOffset: String(OFFSET),
    resultOffset: String(offset),
    resultRecordCount: String(PAGE),
    f: "geojson",
  });
  const url = `${BASE}?${params}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.features) throw new Error("no features");
      return json.features;
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  return [];
}

async function main() {
  const all = [];
  let offset = 0;
  for (;;) {
    const feats = await fetchPage(offset);
    if (feats.length === 0) break;
    for (const f of feats) {
      const p = f.properties ?? {};
      all.push({
        type: "Feature",
        properties: { kod: p.kod, nazev: p.nazev, okres: p.okres, lau: p.nutslau },
        geometry: f.geometry,
      });
    }
    process.stdout.write(`\rStaženo ${all.length} obcí…`);
    if (feats.length < PAGE) break;
    offset += PAGE;
  }
  console.log(`\nCelkem ${all.length} obcí.`);
  mkdirSync("public/geo", { recursive: true });
  writeFileSync(
    "public/geo/obce-cz.geojson",
    JSON.stringify({ type: "FeatureCollection", features: all }),
  );
  console.log("Uloženo do public/geo/obce-cz.geojson");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
