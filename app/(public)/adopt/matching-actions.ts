"use server";

import { generateObject } from "ai";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import type { AdopterPreferences } from "@/lib/matching";
import type { AdopterPreferenceRow } from "@/types/database";

const MODEL = process.env.AI_DESCRIPTION_MODEL || "openai/gpt-4o-mini";

/**
 * Volitelné AI doladění z volného textu (Vercel AI Gateway, server-side).
 * Vytáhne strukturované preference z přirozeného jazyka + krátké persona
 * shrnutí do AI stripu. Bez textu/AI funguje matching čistě na pravidlech.
 */
const refineSchema = z.object({
  species: z.enum(["dog", "cat", "rabbit", "any"]).nullable(),
  housing: z.enum(["apartment", "house"]).nullable(),
  activity: z.enum(["calm", "balanced", "active", "any"]).nullable(),
  experience: z.enum(["none", "some", "experienced"]).nullable(),
  size: z.enum(["small", "medium", "large", "any"]).nullable(),
  special_care_ok: z.boolean().nullable(),
  has_children: z.boolean().nullable(),
  has_pets: z.boolean().nullable(),
  summary: z
    .string()
    .describe("Jedna vřelá věta česky shrnující, jakého parťáka člověk hledá."),
});

export async function refineFromFreetext(
  freetext: string,
  current: AdopterPreferences,
): Promise<{ ok: true; prefs: AdopterPreferences; summary: string } | { error: string }> {
  if (!freetext.trim()) return { error: "Napiš pár slov o tom, koho hledáš." };

  try {
    const { object } = await generateObject({
      model: MODEL,
      schema: refineSchema,
      temperature: 0.4,
      system:
        "Jsi asistent adopčního portálu pro zvířata. Z volného popisu vytáhneš " +
        "preference adoptanta do strukturovaných polí. Co v textu není, nech null " +
        "(nevymýšlej). Piš spisovnou češtinou s diakritikou.",
      prompt:
        `Stávající odpovědi (z kvízu): ${JSON.stringify(current)}\n\n` +
        `Volný popis od uživatele:\n"${freetext.trim()}"\n\n` +
        "Doplň/uprav preference podle textu a napiš jednu shrnující větu.",
    });

    // Sloučení: AI hodnoty doplní jen tam, kde něco vrátila (null = ponech kvíz).
    const merged: AdopterPreferences = { ...current };
    if (object.species) merged.species = object.species;
    if (object.housing) {
      merged.housing = object.housing;
      merged.has_garden = object.housing === "house";
    }
    if (object.activity) merged.activity = object.activity;
    if (object.experience) merged.experience = object.experience;
    if (object.size) merged.size = object.size;
    if (object.special_care_ok !== null) merged.special_care_ok = object.special_care_ok;
    if (object.has_children !== null) merged.has_children = object.has_children;
    if (object.has_pets !== null) merged.has_pets = object.has_pets;

    return { ok: true, prefs: merged, summary: object.summary };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI selhalo.";
    if (/rate.?limit|free tier|too many requests|quota|credits/i.test(msg)) {
      return { error: "AI je dočasně přetížená. Zkus to za chvíli — matching jede i bez ní." };
    }
    if (/api key|unauthor|gateway|credential/i.test(msg)) {
      return { error: "AI brána není nastavená (AI_GATEWAY_API_KEY)." };
    }
    return { error: `AI selhalo: ${msg}` };
  }
}

/** Uloží odpovědi kvízu k návštěvnickému účtu (vyžaduje přihlášení). */
export async function saveAdopterPreferences(input: {
  answers: AdopterPreferences;
  freetext: string;
  aiSummary: string | null;
}): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Pro uložení se přihlas." };

  const { error } = await supabase.from("adopter_preferences").upsert({
    user_id: user.id,
    answers: input.answers as Record<string, unknown>,
    freetext: input.freetext.trim() || null,
    ai_summary: input.aiSummary,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };
  return { ok: true };
}

/** Načte uložené preference přihlášeného návštěvníka (nebo null). */
export async function loadAdopterPreferences(): Promise<{
  answers: AdopterPreferences;
  freetext: string;
  aiSummary: string | null;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("adopter_preferences")
    .select("answers, freetext, ai_summary")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return null;
  const row = data as Pick<AdopterPreferenceRow, "answers" | "freetext" | "ai_summary">;
  return {
    answers: (row.answers ?? {}) as AdopterPreferences,
    freetext: row.freetext ?? "",
    aiSummary: row.ai_summary,
  };
}
