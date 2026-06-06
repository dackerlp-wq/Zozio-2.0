import { type NextRequest } from "next/server";

import { createServiceClient } from "@/lib/supabase/service";
import { SEX_LABEL, SPECIES_LABEL } from "@/lib/format";
import { animalAgeLabel } from "@/lib/animal-age";
import type { AnimalRow, Species } from "@/types/database";

export const dynamic = "force-dynamic";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export function OPTIONS() {
  return new Response(null, { headers: CORS });
}

/** Veřejné CORS API pro embed widget — zvířata útulku dle konfigurace. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/widget/[slug]">) {
  const { slug } = await ctx.params;
  const p = request.nextUrl.searchParams;
  const druh = p.get("druh") ?? "all";
  const count = Math.min(24, Math.max(1, Number(p.get("pocet")) || 6));

  const service = createServiceClient();
  const { data: inst } = await service
    .from("institutions")
    .select("id, name, slug, is_published")
    .eq("slug", slug)
    .maybeSingle();
  if (!inst || !(inst as { is_published: boolean }).is_published) {
    return Response.json({ animals: [] }, { headers: CORS });
  }
  const institution = inst as { id: string; name: string; slug: string };

  let q = service
    .from("animals")
    .select("id, name, species, sex, primary_photo_url, age_years, age_months, birth_date, adoption_status, legal_status")
    .eq("institution_id", institution.id)
    .eq("adoption_status", "available")
    .eq("legal_status", "shelter_owned")
    .order("created_at", { ascending: false })
    .limit(count);
  if (druh === "dog") q = q.eq("species", "dog");
  if (druh === "cat") q = q.eq("species", "cat");
  const { data } = await q;

  const base = request.nextUrl.origin;
  const animals = (
    (data ?? []) as Pick<
      AnimalRow,
      "id" | "name" | "species" | "sex" | "primary_photo_url" | "age_years" | "age_months" | "birth_date"
    >[]
  ).map((a) => ({
    name: a.name,
    species: SPECIES_LABEL[a.species as Species] ?? a.species,
    sex: SEX_LABEL[a.sex] ?? "",
    age: animalAgeLabel({ age_years: a.age_years, age_months: a.age_months, birth_date: a.birth_date }),
    photo: a.primary_photo_url,
    url: `${base}/animals/${a.id}`,
  }));

  return Response.json(
    { institution: institution.name, animals },
    { headers: { ...CORS, "Cache-Control": "public, max-age=300" } },
  );
}
