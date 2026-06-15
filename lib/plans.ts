/**
 * Marketingový číselník tarifů — jeden zdroj pravdy pro veřejné stránky
 * (/pro-utulky, do budoucna /cenik). Ceny jsou bez DPH za měsíc.
 *
 * Pozn.: databázový sloupec `institutions.plan` má zatím hodnoty
 * `free | standard | pro`. Marketingový tarif „Start" odpovídá zavedení
 * čtvrté úrovně a vyžadoval by později migraci billing modelu — zde jde
 * čistě o zobrazení, gating se NEMĚNÍ.
 */

export type PlanId = "free" | "start" | "profi" | "komplet";

export interface MarketingPlan {
  id: PlanId;
  /** Krátké zařazení (nadpis nad názvem). */
  kind: string;
  name: string;
  /** Cena v Kč/měsíc bez DPH. */
  priceCzk: number;
  /** Krátký popis tarifu. */
  description: string;
  features: string[];
  /** Text tlačítka. */
  cta: string;
  /** Zvýrazněný (nejoblíbenější) tarif. */
  popular?: boolean;
}

export const MARKETING_PLANS: MarketingPlan[] = [
  {
    id: "free",
    kind: "Adopční portál",
    name: "Free",
    priceCzk: 0,
    description:
      "Zveřejněte zvířata a hledejte jim domov. Není to evidenční systém.",
    features: [
      "Profil útulku",
      "Profily zvířat v katalogu Zozio",
      "Jednoduchý kontaktní formulář pro adopci",
      "AI matching pro adoptanty",
      "S reklamami",
    ],
    cta: "Začít zdarma",
  },
  {
    id: "start",
    kind: "Evidence & provoz",
    name: "Start",
    priceCzk: 490,
    description: "Plná SaaS platforma pro chod útulku.",
    features: [
      "Vše z Free, bez reklam",
      "Evidence zvířat (příjem, ochranná lhůta, čip, právní stav)",
      "Zdraví, karanténa, kotce",
      "KVS evidence (PDF)",
      "Správa žádostí, úkoly, tým & role",
      "Pěstounská péče",
      "Embed widget",
    ],
    cta: "Vybrat Start",
  },
  {
    id: "profi",
    kind: "Růst & finance",
    name: "Profi",
    priceCzk: 1190,
    description: "Statistiky, sbírky a obsah pro získávání podpory.",
    features: [
      "Vše ze Start",
      "Statistiky & výroční zpráva",
      "Sbírky & dárci (Darujme.cz)",
      "Web & obsah, newsletter",
    ],
    cta: "Vybrat Profi",
    popular: true,
  },
  {
    id: "komplet",
    kind: "Maximum",
    name: "Komplet",
    priceCzk: 2490,
    description: "Vše a vlastní reklamy útulku.",
    features: [
      "Vše z Profi",
      "Vlastní reklamy útulku",
      "Prioritní podpora",
      "Naplánované exporty",
    ],
    cta: "Vybrat Komplet",
  },
];

/** Štítek tarifu u jednotlivých funkcí na landing page. */
export type FeatureTier = "free" | "start" | "profi";

export interface FeatureTile {
  icon: string;
  title: string;
  desc: string;
  tier: FeatureTier;
}

export const FEATURE_TILES: FeatureTile[] = [
  {
    icon: "🐾",
    title: "Evidence zvířat",
    desc: "Příjem, ochranná lhůta, čip, zdraví, právní stav — kompletní karta zvířete.",
    tier: "start",
  },
  {
    icon: "🌐",
    title: "Veřejný profil & adopce",
    desc: "Katalog zvířat, žádosti o adopci online, AI matching adoptantů.",
    tier: "free",
  },
  {
    icon: "🏥",
    title: "Provoz útulku",
    desc: "Zdraví, karanténa, kotce, pěstouni, úkoly a připomínky na jednom místě.",
    tier: "start",
  },
  {
    icon: "📑",
    title: "KVS evidence",
    desc: "Oficiální výstup pro krajskou veterinu jedním klikem. Vždy podle zákona.",
    tier: "start",
  },
  {
    icon: "💝",
    title: "Sbírky & dárci",
    desc: "Sbírky na zvířata, evidence dárců, napojení na Darujme.cz. Z darů 0 %.",
    tier: "profi",
  },
  {
    icon: "📈",
    title: "Statistiky pro granty",
    desc: "Adopce, délka pobytu, náklady, výroční zpráva — čísla, co potřebujete.",
    tier: "profi",
  },
  {
    icon: "🔗",
    title: "Embed widget",
    desc: "Zobrazte svá zvířata i na vlastním webu jedním řádkem kódu.",
    tier: "start",
  },
  {
    icon: "👥",
    title: "Tým & role",
    desc: "Personál i dobrovolníci, každý se svými právy. Vše pod kontrolou.",
    tier: "start",
  },
  {
    icon: "📨",
    title: "Newsletter & web",
    desc: "Články, příběhy, akce a newsletter pro vaše příznivce a dárce.",
    tier: "profi",
  },
];

export const FEATURE_TIER_LABEL: Record<FeatureTier, string> = {
  free: "Free",
  start: "od Start",
  profi: "od Profi",
};

/** Konfigurace banneru „testovací režim" na /pro-utulky. */
export interface TestingMode {
  enabled: boolean;
  total_spots: number;
  used_spots: number;
}

export const DEFAULT_TESTING_MODE: TestingMode = {
  enabled: true,
  total_spots: 5,
  used_spots: 0,
};

/** Zbývající volná místa (nikdy záporně). */
export function remainingSpots(t: TestingMode): number {
  return Math.max(0, t.total_spots - t.used_spots);
}
