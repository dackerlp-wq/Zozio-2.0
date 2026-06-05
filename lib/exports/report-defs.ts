/**
 * Client-safe metadata datových přehledů (bez DB importů), aby je mohla
 * používat i klientská stránka (náhled, výběr sloupců). Samotné sestavení
 * dat je v `reports.ts` (server-only).
 */
export type ReportKey =
  | "intake"
  | "output"
  | "escapes"
  | "deaths"
  | "health"
  | "quarantine_vacc"
  | "foster"
  | "accounting";

export interface ReportDef {
  key: ReportKey;
  label: string;
  desc: string;
  columns: string;
  dated: boolean;
  filename: string;
}

export const REPORT_DEFS: ReportDef[] = [
  {
    key: "intake",
    label: "Přijatá zvířata",
    desc: "Způsob, datum, nález, právní stav.",
    columns: "jméno · druh · příjem · čip · lhůta",
    dated: true,
    filename: "prijata-zvirata",
  },
  {
    key: "output",
    label: "Vydaná zvířata",
    desc: "Adopce, úhyny a vrácení — datum a způsob.",
    columns: "jméno · způsob · datum · majitel",
    dated: true,
    filename: "vydana-zvirata",
  },
  {
    key: "escapes",
    label: "Úniky",
    desc: "Útěky, místo, řešení a nahlášení.",
    columns: "zvíře · datum · místo · řešení",
    dated: true,
    filename: "uniky",
  },
  {
    key: "deaths",
    label: "Úhyny a utracení",
    desc: "Příčina a veterinář.",
    columns: "zvíře · datum · příčina · veterinář",
    dated: true,
    filename: "uhyny-utraceni",
  },
  {
    key: "health",
    label: "Zdravotní zásahy",
    desc: "Úkony, kategorie, poznámky.",
    columns: "zvíře · úkon · datum · veterinář",
    dated: true,
    filename: "zdravotni-zasahy",
  },
  {
    key: "quarantine_vacc",
    label: "Karanténa & očkování",
    desc: "Dohled, izolace, vakcíny s platností.",
    columns: "zvíře · typ · od–do · vakcína",
    dated: true,
    filename: "karantena-ockovani",
  },
  {
    key: "foster",
    label: "Pěstounská péče",
    desc: "Umístění u pěstounů — kdo, kdy, jak dlouho.",
    columns: "zvíře · pěstoun · od–do · výsledek",
    dated: true,
    filename: "pestounska-pece",
  },
  {
    key: "accounting",
    label: "Účetní export",
    desc: "Náklady + příjmy + dary po měsících a kategoriích.",
    columns: "datum · kategorie · částka · typ",
    dated: true,
    filename: "ucetni-export",
  },
];

/** Hlavičky sloupců každého přehledu (musí odpovídat builderům v reports.ts). */
export const REPORT_HEADERS: Record<ReportKey, string[]> = {
  intake: [
    "Číslo záznamu",
    "Jméno",
    "Druh",
    "Pohlaví",
    "Způsob příjmu",
    "Datum příjmu",
    "Místo nálezu",
    "Původní majitel",
    "Právní stav",
    "Ochranná lhůta do",
    "Čip",
    "Stav",
  ],
  output: [
    "Číslo záznamu",
    "Jméno",
    "Druh",
    "Způsob výdeje",
    "Datum",
    "Adoptant",
    "Poplatek (Kč)",
  ],
  escapes: [
    "Číslo záznamu",
    "Jméno",
    "Druh",
    "Datum úniku",
    "Vyřešeno dne",
    "Místo",
    "Popis",
    "Řešení",
    "Nahlášeno",
  ],
  deaths: [
    "Číslo záznamu",
    "Jméno",
    "Druh",
    "Typ",
    "Datum",
    "Příčina",
    "Veterinář",
    "Okolnosti",
  ],
  health: [
    "Číslo záznamu",
    "Jméno",
    "Druh",
    "Datum",
    "Kategorie",
    "Úkon",
    "Poznámka",
    "Veterinář",
  ],
  quarantine_vacc: [
    "Číslo záznamu",
    "Jméno",
    "Druh",
    "Typ",
    "Od / podáno",
    "Do / platnost",
    "Vakcína",
    "Poznámka / veterinář",
  ],
  foster: [
    "Číslo záznamu",
    "Zvíře",
    "Pěstoun",
    "Město",
    "Od",
    "Do / plán",
    "Výsledek",
    "Odměna (Kč)",
  ],
  accounting: ["Datum", "Typ", "Kategorie", "Částka (Kč)", "Zvíře", "Popis"],
};
