"use server";

import { generateText } from "ai";

import { requireMembership } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";
import {
  ENERGY_LABEL,
  HEALTH_STATUS_LABEL,
  SEX_LABEL,
  SIZE_LABEL,
  SPECIES_LABEL,
} from "@/lib/format";
import { animalAgeLabel } from "@/lib/animal-age";
import type { Compatibility } from "@/types/database";

/**
 * AI návrh doporučení pro adoptanta na první dny po převzetí zvířete.
 * Běží přes Vercel AI Gateway (AI_GATEWAY_API_KEY na serveru). Vrací NÁVRH,
 * který pracovník útulku schválí/upraví ve formuláři — nic se neukládá samo.
 */

type Result = { ok: true; text: string } | { error: string };

const COMPAT_TEXT: Record<Compatibility, string> = {
  yes: "ano",
  no: "ne",
  unknown: "neznámo",
};

export async function generateAdoptionRecommendations(
  applicationId: string,
): Promise<Result> {
  const { institutionId } = await requireMembership();
  const service = createServiceClient();

  const { data } = await service
    .from("applications")
    .select(
      `id,
       animal:animals(name, species, breed, is_crossbreed, breed_secondary,
         age_years, age_months, birth_date, sex, size, color, energy_level,
         good_with_children, good_with_dogs, good_with_cats, health_status,
         health_notes, is_neutered, is_vaccinated, personality_tags)`,
    )
    .eq("id", applicationId)
    .eq("institution_id", institutionId)
    .maybeSingle();

  const app = data as unknown as {
    animal: {
      name: string;
      species: string;
      breed: string | null;
      is_crossbreed: boolean;
      breed_secondary: string | null;
      age_years: number | null;
      age_months: number | null;
      birth_date: string | null;
      sex: string;
      size: string | null;
      color: string | null;
      energy_level: string | null;
      good_with_children: Compatibility;
      good_with_dogs: Compatibility;
      good_with_cats: Compatibility;
      health_status: string;
      health_notes: string | null;
      is_neutered: boolean | null;
      is_vaccinated: boolean;
      personality_tags: string[];
    } | null;
  } | null;

  if (!app?.animal) {
    return { error: "Žádost nemá navázané zvíře." };
  }
  const a = app.animal;

  const lines: string[] = [];
  const push = (label: string, value: string | null | undefined) => {
    if (value && value.trim()) lines.push(`- ${label}: ${value}`);
  };
  push("Jméno", a.name);
  push("Druh", SPECIES_LABEL[a.species] ?? a.species);
  const breed = [
    a.breed,
    a.is_crossbreed ? "(kříženec)" : "",
    a.breed_secondary,
  ]
    .filter(Boolean)
    .join(" ");
  push("Plemeno", breed);
  push(
    "Věk",
    animalAgeLabel({
      age_years: a.age_years,
      age_months: a.age_months,
      birth_date: a.birth_date,
    }),
  );
  push("Pohlaví", a.sex !== "unknown" ? SEX_LABEL[a.sex] : "");
  push("Velikost", a.size ? SIZE_LABEL[a.size] : "");
  push("Energie", a.energy_level ? ENERGY_LABEL[a.energy_level] : "");
  push("Snáší děti", COMPAT_TEXT[a.good_with_children]);
  push("Snáší psy", COMPAT_TEXT[a.good_with_dogs]);
  push("Snáší kočky", COMPAT_TEXT[a.good_with_cats]);
  push(
    "Zdravotní stav",
    HEALTH_STATUS_LABEL[a.health_status as keyof typeof HEALTH_STATUS_LABEL],
  );
  push("Zdravotní poznámky", a.health_notes);
  push("Kastrace", a.is_neutered === true ? "ano" : a.is_neutered === false ? "ne" : "");
  push("Očkování", a.is_vaccinated ? "ano" : "");
  if (a.personality_tags.length) push("Povaha", a.personality_tags.join(", "));

  const facts = lines.join("\n");

  try {
    const { text } = await generateText({
      model: process.env.AI_DESCRIPTION_MODEL || "openai/gpt-4o-mini",
      temperature: 0.7,
      system:
        "Jsi zkušený pracovník zvířecího útulku. Píšeš adoptantovi praktická, " +
        "vřelá a konkrétní doporučení na první dny po převzetí zvířete. Používáš " +
        "spisovnou češtinu s diakritikou. Nevymýšlíš si fakta nad rámec zadaných " +
        "údajů. Zaměř se na aklimatizaci, krmení, bezpečí, veterináře a trpělivost. " +
        "Piš stručně — 4 až 6 odrážek uvozených pomlčkou, každá 1 věta. Žádný úvod " +
        "ani závěr, jen odrážky.",
      prompt:
        "Napiš doporučení pro adoptanta na první dny doma podle těchto údajů o zvířeti:\n\n" +
        facts,
    });

    const trimmed = text.trim();
    if (!trimmed) return { error: "AI nevrátila žádný text." };
    return { ok: true, text: trimmed };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Generování selhalo.";
    if (/api key|unauthor|gateway|credential/i.test(msg)) {
      return {
        error: "AI brána není nastavená. Zkontroluj AI_GATEWAY_API_KEY v prostředí.",
      };
    }
    return { error: `AI generování selhalo: ${msg}` };
  }
}
