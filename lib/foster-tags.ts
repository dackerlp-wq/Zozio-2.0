/**
 * Jednotný číselník pěstounských štítků, rozdělený do kategorií.
 *
 * `matchable: true` = štítek, jehož shodu systém umí AUTOMATICKY ověřit
 * z údajů zvířete (druh/velikost, aktivní léčba, pooperační dohled, věk…).
 * Jen tyhle vstupují do skóre párování. Ostatní (prostředí, zkušenosti)
 * jsou doplňkové — zobrazují se, ale párovací % neovlivňují.
 */
export type FosterTagCategory = "species" | "health" | "environment" | "experience";

export interface FosterTag {
  key: string;
  label: string;
  icon: string;
  category: FosterTagCategory;
  matchable: boolean;
}

export const FOSTER_TAG_CATEGORIES: {
  key: FosterTagCategory;
  label: string;
  matchable: boolean;
}[] = [
  { key: "species", label: "Druh & velikost", matchable: true },
  { key: "health", label: "Zdravotní péče", matchable: true },
  { key: "environment", label: "Prostředí & domácnost", matchable: false },
  { key: "experience", label: "Zkušenost & specializace", matchable: false },
];

export const FOSTER_TAGS: FosterTag[] = [
  // Druh & velikost — ověřitelné z druhu/velikosti/věku zvířete
  { key: "big_dogs", label: "Velcí psi", icon: "🐶", category: "species", matchable: true },
  { key: "small_dogs", label: "Malí psi", icon: "🐕", category: "species", matchable: true },
  { key: "cats", label: "Kočky", icon: "🐈", category: "species", matchable: true },
  { key: "small_animals", label: "Malá zvířata", icon: "🐹", category: "species", matchable: true },
  { key: "puppies", label: "Štěňata / mláďata", icon: "🍼", category: "species", matchable: true },

  // Zdravotní péče — ověřitelné z léčby / dohledu
  { key: "meds", label: "Podávání léků", icon: "💉", category: "health", matchable: true },
  { key: "post_op", label: "Pooperační péče", icon: "🩹", category: "health", matchable: true },
  { key: "palliative", label: "Paliativní péče", icon: "🕊️", category: "health", matchable: false },
  { key: "special_diet", label: "Speciální dieta", icon: "🥣", category: "health", matchable: false },

  // Prostředí & domácnost — část ověřitelná ze strukturovaných údajů zvířete
  // (zahrada / snášenlivost s dětmi a zvířaty), zbytek doplňkový.
  { key: "garden", label: "Dům se zahradou", icon: "🏡", category: "environment", matchable: true },
  { key: "children", label: "Děti v domácnosti", icon: "👶", category: "environment", matchable: true },
  { key: "no_children", label: "Bez dětí", icon: "🙅", category: "environment", matchable: true },
  { key: "other_pets", label: "Jiná zvířata doma", icon: "🐾", category: "environment", matchable: true },
  { key: "fenced", label: "Oplocený pozemek", icon: "🚧", category: "environment", matchable: false },
  { key: "apartment", label: "Byt", icon: "🏢", category: "environment", matchable: false },
  { key: "home_all_day", label: "Někdo stále doma", icon: "🏠", category: "environment", matchable: false },

  // Zkušenost & specializace — doplňkové
  { key: "socialization", label: "Socializace", icon: "🤝", category: "experience", matchable: false },
  { key: "behavior", label: "Problémové chování", icon: "🧠", category: "experience", matchable: false },
  { key: "senior", label: "Senioři", icon: "👴", category: "experience", matchable: false },
  { key: "shy", label: "Plaché / bázlivé", icon: "🫣", category: "experience", matchable: false },
];

const BY_KEY = new Map(FOSTER_TAGS.map((t) => [t.key, t]));

/**
 * Vzájemně se vylučující štítky — když je vybraný jeden, druhý nedává smysl
 * (a párování by si protiřečilo). Mapa je symetrická.
 */
export const FOSTER_TAG_OPPOSITES: Record<string, string> = {
  children: "no_children",
  no_children: "children",
};

/** Vrátí protikladný štítek (pokud existuje). */
export function oppositeTag(key: string): string | undefined {
  return FOSTER_TAG_OPPOSITES[key];
}

/** Klíče štítků, které vstupují do párovacího skóre. */
export const MATCHABLE_TAG_KEYS = FOSTER_TAGS.filter((t) => t.matchable).map((t) => t.key);

export function fosterTagLabel(key: string): string {
  const t = BY_KEY.get(key);
  return t ? `${t.icon} ${t.label}` : key;
}

export function fosterTagLabelPlain(key: string): string {
  return BY_KEY.get(key)?.label ?? key;
}

export function isMatchableTag(key: string): boolean {
  return BY_KEY.get(key)?.matchable ?? false;
}
