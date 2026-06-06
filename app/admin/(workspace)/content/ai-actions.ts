"use server";

import { generateObject } from "ai";
import { z } from "zod";

import { ensurePermission } from "@/lib/auth";
import { sanitizeHtml } from "@/lib/sanitize";
import { SITE_URL } from "@/lib/email/config";
import { animalAgeLabel } from "@/lib/animal-age";
import {
  ADOPTION_STATUS_LABEL,
  ENERGY_LABEL,
  HEALTH_STATUS_LABEL,
  SEX_LABEL,
  SIZE_LABEL,
  SPECIES_LABEL,
} from "@/lib/format";
import type { ContentType, Species } from "@/types/database";

/**
 * AI generátor obsahu pro modul Web & obsah.
 *
 * Běží přes Vercel AI Gateway (model jako "provider/model", klíč
 * AI_GATEWAY_API_KEY na serveru). Vše je NÁVRH — pracovník ho upraví a teprve
 * pak uloží (human-in-the-loop). Žádné fakta si AI nevymýšlí nad rámec zadání.
 */

const MODEL = process.env.AI_DESCRIPTION_MODEL || "openai/gpt-4o-mini";

const SYSTEM =
  "Jsi zkušený český copywriter pro zvířecí útulek. Píšeš vřele, konkrétně a " +
  "důvěryhodně, bez klišé a přehnaného patosu. Používáš výhradně spisovnou " +
  "češtinu s diakritikou. Nevymýšlíš si fakta nad rámec zadání — co nevíš, " +
  "nezmiňuješ. Cílem je oslovit veřejnost a pomoci útulku.";

const TONE_LABEL: Record<string, string> = {
  warm: "vřelý a osobní",
  informative: "věcný a informativní",
  urgent: "naléhavý, s výzvou k akci",
  celebratory: "radostný a oslavný",
};

const TYPE_LABEL: Record<ContentType, string> = {
  article: "novinka / článek pro veřejnost",
  story: "dojemný příběh se šťastným koncem",
  event: "pozvánka na akci útulku",
};

const articleSchema = z.object({
  title: z.string().describe("Chytlavý nadpis článku, max 8 slov, česky."),
  excerpt: z
    .string()
    .describe("Krátký perex (1–2 věty) shrnující článek, česky."),
  body_html: z
    .string()
    .describe(
      "Tělo článku jako jednoduché HTML. Povolené značky: <p>, <h2>, <h3>, " +
        "<ul>, <ol>, <li>, <strong>, <em>, <blockquote>. Žádné <html>, <body>, " +
        "<script>, styly ani třídy. 3–6 odstavců, smysluplně strukturováno. Česky.",
    ),
});

export type GeneratedArticle = z.infer<typeof articleSchema>;

type ArticleResult = { ok: true; data: GeneratedArticle } | { error: string };
type TextResult = { ok: true; text: string } | { error: string };

function aiError(e: unknown): string {
  const msg = e instanceof Error ? e.message : "Generování selhalo.";
  if (/rate.?limit|free tier|too many requests|quota|top-up|credits/i.test(msg)) {
    return (
      "AI je dočasně přetížená (vyčerpaný bezplatný limit modelu). " +
      "Zkus to za chvíli znovu, nebo si v nastavení AI brány dobij kredit, " +
      "případně přepni model přes proměnnou AI_DESCRIPTION_MODEL."
    );
  }
  if (/api key|unauthor|gateway|credential/i.test(msg)) {
    return "AI brána není nastavená. Zkontroluj AI_GATEWAY_API_KEY v prostředí.";
  }
  return `AI generování selhalo: ${msg}`;
}

/** Načte fakta o označeném zvířeti (scoped na instituci) pro AI prompt. */
async function loadAnimalFacts(
  institutionId: string,
  animalId: string,
): Promise<{ facts: string; animalUrl: string; name: string } | null> {
  const { createServiceClient } = await import("@/lib/supabase/service");
  const service = createServiceClient();
  const { data } = await service
    .from("animals")
    .select(
      `id, name, species, breed, is_crossbreed, breed_secondary, age_years,
       age_months, birth_date, sex, size, color, energy_level, good_with_children,
       good_with_dogs, good_with_cats, health_status, health_notes,
       personality_tags, adoption_status`,
    )
    .eq("id", animalId)
    .eq("institution_id", institutionId)
    .maybeSingle();
  if (!data) return null;

  const a = data as Record<string, unknown>;
  const lines: string[] = [];
  const push = (label: string, v: string | null | undefined) => {
    if (v && String(v).trim()) lines.push(`- ${label}: ${v}`);
  };
  push("Jméno", a.name as string);
  push("Druh", SPECIES_LABEL[a.species as Species] ?? (a.species as string));
  const breed = [
    a.breed as string,
    a.is_crossbreed ? "(kříženec)" : "",
    a.breed_secondary as string,
  ]
    .filter(Boolean)
    .join(" ");
  push("Plemeno", breed);
  push(
    "Věk",
    animalAgeLabel({
      age_years: a.age_years as number | null,
      age_months: a.age_months as number | null,
      birth_date: a.birth_date as string | null,
    }),
  );
  push("Pohlaví", a.sex && a.sex !== "unknown" ? SEX_LABEL[a.sex as string] : "");
  push("Velikost", a.size ? SIZE_LABEL[a.size as string] : "");
  push("Barva", a.color as string);
  push("Energie", a.energy_level ? ENERGY_LABEL[a.energy_level as string] : "");
  const compat = (v: unknown) => (v === "yes" ? "ano" : v === "no" ? "ne" : "neznámo");
  push("Snáší děti", compat(a.good_with_children));
  push("Snáší psy", compat(a.good_with_dogs));
  push("Snáší kočky", compat(a.good_with_cats));
  push(
    "Zdravotní stav",
    HEALTH_STATUS_LABEL[a.health_status as keyof typeof HEALTH_STATUS_LABEL],
  );
  push("Zdravotní poznámky", a.health_notes as string);
  push(
    "Stav adopce",
    ADOPTION_STATUS_LABEL[a.adoption_status as keyof typeof ADOPTION_STATUS_LABEL],
  );
  if (Array.isArray(a.personality_tags) && a.personality_tags.length)
    push("Povahové štítky", (a.personality_tags as string[]).join(", "));

  return {
    facts: lines.join("\n"),
    animalUrl: `${SITE_URL}/animals/${a.id as string}`,
    name: a.name as string,
  };
}

/** Vygeneruje návrh celého článku (nadpis + perex + tělo) z tématu. */
export async function generateArticle(input: {
  topic: string;
  type: ContentType;
  tone: string;
  institutionName: string;
  animalId?: string | null;
}): Promise<ArticleResult> {
  const perm = await ensurePermission("web");
  if (!perm.ok) return { error: perm.error };
  if (!input.topic.trim()) return { error: "Zadej téma článku." };

  const { institutionId, institution } = perm.membership;
  const shelterUrl = `${SITE_URL}/utulek/${institution.slug}`;

  // Pokud je označené zvíře, načteme jeho fakta a postavíme článek kolem něj.
  let animal: { facts: string; animalUrl: string; name: string } | null = null;
  if (input.animalId) {
    animal = await loadAnimalFacts(institutionId, input.animalId);
  }

  try {
    const { object } = await generateObject({
      model: MODEL,
      schema: articleSchema,
      temperature: 0.8,
      system: SYSTEM,
      prompt:
        `Napiš ${TYPE_LABEL[input.type]} pro útulek „${input.institutionName}".\n\n` +
        `Téma / zadání od pracovníka:\n${input.topic.trim()}\n\n` +
        (animal
          ? `Článek se týká konkrétního zvířete — postav ho kolem něj a využij tato fakta ` +
            `(nic si nedomýšlej nad jejich rámec):\n${animal.facts}\n\n` +
            `V závěru přidej vřelou výzvu k adopci/podpoře a vlož HTML odkaz přímo na profil ` +
            `tohoto zvířete: <a href="${animal.animalUrl}">${animal.name} na Zozio.cz</a>.\n\n`
          : "") +
        `Tón: ${TONE_LABEL[input.tone] ?? "vřelý a osobní"}.\n\n` +
        `Vždy přirozeně zmiň, že útulek najdou čtenáři na portálu Zozio.cz, a do textu ` +
        `vlož HTML odkaz na profil útulku: <a href="${shelterUrl}">${input.institutionName} na Zozio.cz</a>. ` +
        `Odkazy uváděj jako platné <a href> značky, ne jako holý text.\n\n` +
        "Vrať strukturovaný formát. Tělo piš jako čisté HTML s povolenými značkami.",
    });

    return {
      ok: true,
      data: { ...object, body_html: sanitizeHtml(object.body_html) },
    };
  } catch (e) {
    return { error: aiError(e) };
  }
}

/** Vylepší / přepíše označený úryvek (stylistika, gramatika) — vrací prostý text. */
export async function improveText(text: string): Promise<TextResult> {
  const perm = await ensurePermission("web");
  if (!perm.ok) return { error: perm.error };
  if (!text.trim()) return { error: "Není co vylepšit." };

  try {
    const { object } = await generateObject({
      model: MODEL,
      schema: z.object({
        improved: z
          .string()
          .describe(
            "Vylepšená verze textu — stejný význam i délka, lepší stylistika a " +
              "gramatika, spisovná čeština. Vrať jen prostý text bez značek.",
          ),
      }),
      temperature: 0.6,
      system: SYSTEM,
      prompt:
        "Uhlaď tento text pro web útulku. Zachovej význam a přibližnou délku, " +
        "neměň fakta:\n\n" +
        text.trim(),
    });
    return { ok: true, text: object.improved };
  } catch (e) {
    return { error: aiError(e) };
  }
}
