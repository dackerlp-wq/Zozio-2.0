/**
 * Pomocné funkce dokumentů zvířete — bez DB.
 * Auto-pojmenování souborů + výpočet požadovaných dokumentů dle typu příjmu.
 */
import type { AnimalDocumentCategory, AnimalIntakeType } from "@/types/database";

/** Odstraní diakritiku a nebezpečné znaky pro název souboru. */
function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "soubor";
}

const CAT_SLUG: Record<AnimalDocumentCategory, string> = {
  medical: "lekarska-zprava",
  vaccination: "ockovaci-prukaz",
  lab: "laborator",
  contract: "smlouva",
  intake: "prijmovy-doklad",
  registration: "registrace",
  other: "dokument",
};

/** Auto-název: {record_number|id}_{jméno}_{typ}.{ext} */
export function autoDocName(
  recordNumber: string | null,
  animalName: string,
  category: AnimalDocumentCategory,
  ext = "pdf",
): string {
  const rec = (recordNumber ?? "").replace(/\//g, "-").trim() || "bez-cisla";
  return `${rec}_${slug(animalName)}_${CAT_SLUG[category]}.${ext}`;
}

/** Název ZIP balíčku adopční složky: {record_number|id}_{jméno}_adopcni-slozka.zip */
export function adoptionBundleName(recordNumber: string | null, animalName: string): string {
  const rec = (recordNumber ?? "").replace(/\//g, "-").trim() || "bez-cisla";
  return `${rec}_${slug(animalName)}_adopcni-slozka.zip`;
}

// --- Požadované dokumenty dle typu příjmu ----------------------------------

export type RequiredState = "ok" | "missing" | "later";

export interface RequiredDoc {
  category: AnimalDocumentCategory;
  label: string;
  state: RequiredState;
}

/**
 * Co má zvíře mít podle způsobu příjmu. `later` = založí se až při adopci
 * (smlouva). Stav `ok`/`missing` se počítá z existujících kategorií dokumentů.
 */
export function requiredDocs(
  intakeType: AnimalIntakeType | null,
  existingCategories: AnimalDocumentCategory[],
): RequiredDoc[] {
  const has = (c: AnimalDocumentCategory) => existingCategories.includes(c);

  // Základ pro všechna zvířata v útulku.
  const base: { category: AnimalDocumentCategory; label: string; when: RequiredState }[] = [
    { category: "intake", label: "Příjmový doklad", when: "missing" },
    { category: "registration", label: "Potvrzení o čipování", when: "missing" },
    { category: "vaccination", label: "Očkovací průkaz", when: "missing" },
    { category: "medical", label: "Zdravotní zpráva", when: "missing" },
    { category: "contract", label: "Adopční smlouva", when: "later" },
  ];

  // Nalezenec navíc potřebuje doklad o vyhlášení/registraci — registration už pokrývá.
  return base.map((b) => ({
    category: b.category,
    label: b.label,
    state: b.when === "later" ? (has(b.category) ? "ok" : "later") : has(b.category) ? "ok" : "missing",
  }));
}

export function requiredSummary(docs: RequiredDoc[]): { done: number; total: number } {
  const counted = docs.filter((d) => d.state !== "later");
  return { done: counted.filter((d) => d.state === "ok").length, total: counted.length };
}
