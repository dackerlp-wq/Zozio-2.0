"use server";

import { generateObject } from "ai";
import { z } from "zod";

import { requireMembership } from "@/lib/auth";
import {
  ENERGY_LABEL,
  HEALTH_STATUS_LABEL,
  SEX_LABEL,
  SIZE_LABEL,
  SPECIES_LABEL,
} from "@/lib/format";
import { animalAgeLabel } from "@/lib/animal-age";
import type { Compatibility, Species } from "@/types/database";

/**
 * AI generátor adopčního textu zvířete.
 *
 * Běží přes Vercel AI Gateway (model jako "provider/model" string, klíč
 * AI_GATEWAY_API_KEY na serveru). Vrací NÁVRH, který člověk schválí ve
 * formuláři — nic se neukládá automaticky (human-in-the-loop).
 */

/** Vstupní fakta o zvířeti z formuláře (vše nepovinné). */
export interface AnimalCopyInput {
  name: string;
  species: Species;
  breed: string;
  is_crossbreed: boolean;
  breed_secondary: string;
  age_years: number | null;
  age_months: number | null;
  sex: string;
  size: string | null;
  color: string;
  energy_level: string | null;
  good_with_children: Compatibility;
  good_with_dogs: Compatibility;
  good_with_cats: Compatibility;
  health_status: string;
  health_notes: string;
  personality_tags: string[];
  /** Volitelná dodatečná instrukce od pracovníka útulku. */
  hint?: string;
}

export interface AnimalCopy {
  description: string;
  story_title: string;
  story_text: string;
  personality_tags: string[];
}

type CopyResult = { ok: true; data: AnimalCopy } | { error: string };

const COMPAT_TEXT: Record<Compatibility, string> = {
  yes: "ano",
  no: "ne",
  unknown: "neznámo",
};

const schema = z.object({
  description: z
    .string()
    .describe("Krátký poutavý popis pro katalog adopce, 1–3 věty, česky."),
  story_title: z
    .string()
    .describe("Chytlavý nadpis příběhu, maximálně 6 slov, česky."),
  story_text: z
    .string()
    .describe(
      "Delší vyprávěcí příběh psaný v první nebo třetí osobě, 3–6 vět, česky, vřelý a konkrétní.",
    ),
  personality_tags: z
    .array(z.string())
    .describe(
      "3–6 krátkých povahových štítků česky (1–2 slova, malá písmena), např. 'mazlivý', 'hravý', 'klidný'.",
    ),
});

/** Sestaví čitelný seznam faktů o zvířeti pro prompt. */
function buildFacts(input: AnimalCopyInput): string {
  const lines: string[] = [];
  const push = (label: string, value: string | null | undefined) => {
    if (value && value.trim()) lines.push(`- ${label}: ${value}`);
  };

  push("Jméno", input.name);
  push("Druh", SPECIES_LABEL[input.species]);
  const breed = [
    input.breed,
    input.is_crossbreed ? "(kříženec)" : "",
    input.breed_secondary,
  ]
    .filter(Boolean)
    .join(" ");
  push("Plemeno", breed);
  push("Věk", animalAgeLabel(input));
  push("Pohlaví", input.sex !== "unknown" ? SEX_LABEL[input.sex] : "");
  push("Velikost", input.size ? SIZE_LABEL[input.size] : "");
  push("Barva", input.color);
  push("Energie", input.energy_level ? ENERGY_LABEL[input.energy_level] : "");
  push("Snáší děti", COMPAT_TEXT[input.good_with_children]);
  push("Snáší psy", COMPAT_TEXT[input.good_with_dogs]);
  push("Snáší kočky", COMPAT_TEXT[input.good_with_cats]);
  push(
    "Zdravotní stav",
    HEALTH_STATUS_LABEL[input.health_status as keyof typeof HEALTH_STATUS_LABEL],
  );
  push("Zdravotní poznámky", input.health_notes);
  if (input.personality_tags.length)
    push("Stávající štítky", input.personality_tags.join(", "));
  if (input.hint) push("Doplňující pokyn od pracovníka", input.hint);

  return lines.join("\n");
}

/**
 * Varianta pro záložku Profil — fakta načte z DB podle ID zvířete (vč. zdraví
 * a energie, které editor profilu nemá), takže návrh je co nejkonkrétnější.
 */
export async function generateAnimalCopyForAnimal(
  animalId: string,
  hint?: string,
): Promise<CopyResult> {
  const { institutionId } = await requireMembership();
  const { createServiceClient } = await import("@/lib/supabase/service");
  const service = createServiceClient();

  const { data } = await service
    .from("animals")
    .select(
      `name, species, breed, is_crossbreed, breed_secondary, age_years,
       age_months, sex, size, color, energy_level, good_with_children,
       good_with_dogs, good_with_cats, health_status, health_notes,
       personality_tags`,
    )
    .eq("id", animalId)
    .eq("institution_id", institutionId)
    .maybeSingle();

  if (!data) return { error: "Zvíře nepatří tvému útulku." };
  const a = data as unknown as {
    name: string;
    species: Species;
    breed: string | null;
    is_crossbreed: boolean;
    breed_secondary: string | null;
    age_years: number | null;
    age_months: number | null;
    sex: string;
    size: string | null;
    color: string | null;
    energy_level: string | null;
    good_with_children: Compatibility;
    good_with_dogs: Compatibility;
    good_with_cats: Compatibility;
    health_status: string;
    health_notes: string | null;
    personality_tags: string[];
  };

  return generateAnimalCopy({
    name: a.name,
    species: a.species,
    breed: a.breed ?? "",
    is_crossbreed: a.is_crossbreed,
    breed_secondary: a.breed_secondary ?? "",
    age_years: a.age_years,
    age_months: a.age_months,
    sex: a.sex,
    size: a.size,
    color: a.color ?? "",
    energy_level: a.energy_level,
    good_with_children: a.good_with_children,
    good_with_dogs: a.good_with_dogs,
    good_with_cats: a.good_with_cats,
    health_status: a.health_status,
    health_notes: a.health_notes ?? "",
    personality_tags: a.personality_tags ?? [],
    hint,
  });
}

export async function generateAnimalCopy(
  input: AnimalCopyInput,
): Promise<CopyResult> {
  // Jen přihlášený člen útulku smí generovat.
  await requireMembership();

  if (!input.name?.trim()) {
    return { error: "Nejdřív vyplň alespoň jméno zvířete." };
  }

  const facts = buildFacts(input);

  try {
    const { object } = await generateObject({
      model: process.env.AI_DESCRIPTION_MODEL || "openai/gpt-4o-mini",
      schema,
      temperature: 0.8,
      system:
        "Jsi zkušený český copywriter pro zvířecí útulek. Píšeš vřele, " +
        "konkrétně a důvěryhodně, bez klišé a přehnaného patosu. Používáš " +
        "výhradně spisovnou češtinu s diakritikou. Nevymýšlíš si fakta nad " +
        "rámec zadaných údajů — co nevíš, nezmiňuješ. Cílem je pomoci zvířeti " +
        "najít domov.",
      prompt:
        "Na základě následujících údajů o zvířeti napiš adopční texty.\n\n" +
        facts +
        "\n\nDodrž požadovaný strukturovaný formát.",
    });

    return { ok: true, data: object };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generování selhalo.";
    // Typická příčina: chybějící klíč brány.
    if (/api key|unauthor|gateway|credential/i.test(msg)) {
      return {
        error:
          "AI brána není nastavená. Zkontroluj AI_GATEWAY_API_KEY v prostředí.",
      };
    }
    return { error: `AI generování selhalo: ${msg}` };
  }
}
