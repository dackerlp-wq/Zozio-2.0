"use server";

import { generateObject } from "ai";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { idealHome, type IdealHomeInput, type IdealHome } from "@/lib/ideal-home";
import type { AnimalIdealHomeRow } from "@/types/database";

const MODEL = process.env.AI_DESCRIPTION_MODEL || "openai/gpt-4o-mini";

function hashAttrs(a: IdealHomeInput): string {
  return JSON.stringify([
    a.energy_level,
    a.care_difficulty,
    a.adopter_experience,
    a.suitable_housing,
    a.needs_garden,
    a.good_with_children,
    a.good_with_dogs,
    a.good_with_cats,
    a.health_status,
    a.size,
  ]);
}

/**
 * „Ideální domov" — deterministická základna + (volitelně) hezčí AI formulace,
 * uložené do cache (animal_ideal_home). AI se nevolá při každém načtení:
 * při shodě attr_hash vrací cache, jinak vygeneruje a uloží. Když AI selže,
 * uloží deterministickou verzi (žádné opakované volání).
 */
export async function getOrGenerateIdealHome(
  animalId: string,
): Promise<IdealHome & { ai: boolean }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("animals")
    .select(
      "energy_level, care_difficulty, adopter_experience, suitable_housing, needs_garden, good_with_children, good_with_dogs, good_with_cats, health_status, size, description, story_text, name, species",
    )
    .eq("id", animalId)
    .maybeSingle();
  if (!data) return { fits: [], notFits: [], ai: false };

  const a = data as IdealHomeInput & {
    description: string | null;
    story_text: string | null;
    name: string;
    species: string;
  };
  const base = idealHome(a);
  const hash = hashAttrs(a);

  // Cache hit?
  const { data: cached } = await supabase
    .from("animal_ideal_home")
    .select("fits, not_fits, attr_hash")
    .eq("animal_id", animalId)
    .maybeSingle();
  const c = cached as Pick<AnimalIdealHomeRow, "fits" | "not_fits" | "attr_hash"> | null;
  if (c && c.attr_hash === hash) {
    return { fits: c.fits, notFits: c.not_fits, ai: true };
  }

  // Vygenerovat (AI nadstavba), s gracefulním fallbackem na deterministiku.
  let result: IdealHome = base;
  try {
    const bio = (a.story_text || a.description || "").slice(0, 600);
    const { object } = await generateObject({
      model: MODEL,
      temperature: 0.5,
      schema: z.object({
        fits: z.array(z.string()).describe("3 až 5 vět: komu zvíře sedne (Hodí se k)."),
        not_fits: z.array(z.string()).describe("2 až 4 věty: pro koho není vhodné (Nehodí se k)."),
      }),
      system:
        "Jsi český poradce adopcí zvířat. Z pravidlové základny a (volitelně) " +
        "příběhu vytvoříš hezčí, konkrétní a pravdivé formulace ideálního domova. " +
        "Nevymýšlej fakta nad rámec zadání. Spisovná čeština, krátké jasné věty.",
      prompt:
        `Zvíře: ${a.name} (${a.species}).\n` +
        `Pravidlová základna „Hodí se k": ${base.fits.join("; ")}\n` +
        `Pravidlová základna „Nehodí se k": ${base.notFits.join("; ")}\n` +
        (bio ? `Příběh/popis: ${bio}\n` : "") +
        "Přeformuluj přívětivěji a konkrétněji, drž se faktů ze základny.",
    });
    if (object.fits.length) {
      result = { fits: object.fits.slice(0, 5), notFits: object.not_fits.slice(0, 4) };
    }
  } catch {
    result = base; // AI nedostupná → deterministika
  }

  // Ulož do cache (service role kvůli RLS zápisu).
  try {
    const service = createServiceClient();
    await service.from("animal_ideal_home").upsert({
      animal_id: animalId,
      fits: result.fits,
      not_fits: result.notFits,
      attr_hash: hash,
      generated_at: new Date().toISOString(),
    });
  } catch {
    /* cache je nice-to-have */
  }

  return { ...result, ai: result !== base };
}
