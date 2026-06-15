// Vytvoří číselník okres_kod → název kraje z ČÚZK RÚIAN.
// Spuštění: node scripts/fetch-okresy-kraje.mjs
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = "https://ags.cuzk.cz/arcgis/rest/services/RUIAN/Prohlizeci_sluzba_nad_daty_RUIAN/MapServer";

async function q(layer, outFields) {
  const params = new URLSearchParams({
    where: "1=1",
    outFields,
    returnGeometry: "false",
    f: "json",
  });
  const res = await fetch(`${BASE}/${layer}/query?${params}`);
  const json = await res.json();
  return json.features.map((f) => f.attributes);
}

async function main() {
  const [okresy, kraje] = await Promise.all([
    q(15, "kod,vusc"), // okres → kraj kód
    q(17, "kod,nazev"), // kraj kód → název
  ]);
  const krajName = new Map(kraje.map((k) => [k.kod, k.nazev]));
  const out = {};
  for (const o of okresy) {
    out[o.kod] = krajName.get(o.vusc) ?? null;
  }
  mkdirSync("public/geo", { recursive: true });
  writeFileSync("public/geo/okresy-kraje.json", JSON.stringify(out));
  console.log(`Uloženo ${Object.keys(out).length} okresů → public/geo/okresy-kraje.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
