import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { adoptionFormBlock } from "@/lib/animal-readiness";
import { SPECIES_LABEL, SEX_LABEL } from "@/lib/format";
import { animalAgeLabel } from "@/lib/animal-age";
import { loadAdopterPreferences } from "../../../adopt/matching-actions";
import type {
  AdopterExperience,
  AdoptionStatus,
  AnimalLegalStatus,
  AnimalSize,
  ApplicationQuestionRow,
  CareDifficulty,
  Compatibility,
  EnergyLevel,
  HealthStatus,
  Sex,
  Species,
  SuitableHousing,
} from "@/types/database";

import { ApplicationForm, type Prefill } from "./application-form";
import { MatchBadge } from "./match-badge";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ typ?: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("animals").select("name").eq("id", id).maybeSingle();
  return {
    title: data ? `Zájem o adopci — ${data.name} · Zozio` : "Zájem o adopci · Zozio",
    robots: { index: false },
  };
}

interface AnimalRow {
  id: string;
  name: string;
  sex: Sex;
  species: Species;
  breed: string | null;
  age_years: number | null;
  age_months: number | null;
  birth_date: string | null;
  primary_photo_url: string | null;
  adoption_status: AdoptionStatus;
  legal_status: AnimalLegalStatus;
  protection_until: string | null;
  size: AnimalSize | null;
  energy_level: EnergyLevel | null;
  good_with_children: Compatibility;
  good_with_dogs: Compatibility;
  good_with_cats: Compatibility;
  needs_garden: boolean | null;
  suitable_housing: SuitableHousing | null;
  adopter_experience: AdopterExperience;
  care_difficulty: CareDifficulty | null;
  health_status: HealthStatus;
  institution: { name: string; slug: string; city: string | null; foster_enabled: boolean } | null;
}

export default async function AdoptionInterestPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { typ } = await searchParams;
  const foster = typ === "foster";
  const supabase = await createClient();

  const { data } = await supabase
    .from("animals")
    .select(
      `id, name, sex, species, breed, age_years, age_months, birth_date, primary_photo_url,
       adoption_status, legal_status, protection_until, size, energy_level,
       good_with_children, good_with_dogs, good_with_cats, needs_garden, suitable_housing,
       adopter_experience, care_difficulty, health_status,
       institution:institutions!inner(name, slug, city, foster_enabled, is_published)`,
    )
    .eq("id", id)
    .eq("institutions.is_published", true)
    .maybeSingle();

  const animal = data as unknown as AnimalRow | null;
  if (!animal) notFound();

  const fosterEligible = !!animal.institution?.foster_enabled || animal.adoption_status === "foster";
  const allowed = foster
    ? animal.adoption_status === "available" || animal.adoption_status === "foster"
    : animal.adoption_status === "available";
  if (!allowed) redirect(`/animals/${id}`);

  const block = adoptionFormBlock({
    legal_status: animal.legal_status,
    protection_until: animal.protection_until,
  });

  // Předvyplnění z účtu + AI preferencí.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [savedPrefs, profileRes] = await Promise.all([
    loadAdopterPreferences(),
    user
      ? supabase.from("applicant_profiles").select("full_name, phone, city").eq("user_id", user.id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const profile = (profileRes.data ?? null) as { full_name: string | null; phone: string | null; city: string | null } | null;
  const a = savedPrefs?.answers;
  const prefill: Prefill = {
    name: profile?.full_name ?? "",
    email: user?.email ?? "",
    phone: profile?.phone ?? "",
    city: profile?.city ?? "",
    housing: a?.housing ?? "",
    experience: a?.experience ?? "",
    has_garden: a?.has_garden,
    has_children: a?.has_children,
    has_pets: a?.has_pets,
  };

  // Vlastní otázky útulku (aktivní, dle druhu zvířete).
  const questions = await loadQuestions(supabase, animal);

  const inst = animal.institution;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Link href={`/animals/${id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-terracotta-600">
        <ChevronLeft className="size-4" /> Zpět na profil {animal.name}
      </Link>
      <div className="mt-1 text-xs font-bold uppercase tracking-[0.15em] text-terracotta-600">
        {foster ? "Nabídka dočasné péče" : "Zájem o adopci"}
      </div>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* FORMULÁŘ */}
        <div className="rounded-3xl bg-card p-6 ring-1 ring-ink-900/8 sm:p-8">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink-900">
            {foster ? `Nabídni domov ${animal.name}` : `Napiš ${animal.name}`}
          </h1>

          {block?.blocked ? (
            <div className="mt-6 rounded-2xl bg-sunshine-200/50 p-5 ring-1 ring-sunshine-400/40">
              <h2 className="font-display text-lg font-bold text-sunshine-600">Žádost zatím nelze podat</h2>
              <p className="mt-1.5 text-sm text-ink-600">{block.reason}</p>
              <Link href={`/animals/${id}`} className="mt-3 inline-block text-sm font-bold text-terracotta-600">
                ← Zpět na profil
              </Link>
            </div>
          ) : (
            <>
              <p className="mt-2 text-ink-600">
                Vyplň pár údajů a útulek se ti co nejdřív ozve. Nic tě nezavazuje — je to první krok k seznámení.
              </p>
              <div className="mt-7">
                <ApplicationForm
                  animalId={animal.id}
                  animalName={animal.name}
                  prefill={prefill}
                  foster={foster}
                  fosterEligible={fosterEligible}
                  questions={questions}
                  prefilledFromAI={!!savedPrefs}
                />
              </div>
            </>
          )}
        </div>

        {/* SIDEBAR */}
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <div className="overflow-hidden rounded-3xl bg-card ring-1 ring-ink-900/8">
            <div className="relative flex h-36 items-center justify-center overflow-hidden bg-cream-warm text-5xl">
              {animal.primary_photo_url ? (
                <Image src={animal.primary_photo_url} alt={animal.name} fill sizes="320px" className="object-cover" />
              ) : animal.species === "cat" ? (
                "🐈"
              ) : animal.species === "rabbit" ? (
                "🐰"
              ) : (
                "🐕"
              )}
              <MatchBadge
                initialPrefs={savedPrefs}
                animal={{
                  species: animal.species,
                  size: animal.size,
                  energy_level: animal.energy_level,
                  good_with_children: animal.good_with_children,
                  good_with_dogs: animal.good_with_dogs,
                  good_with_cats: animal.good_with_cats,
                  needs_garden: animal.needs_garden,
                  suitable_housing: animal.suitable_housing,
                  adopter_experience: animal.adopter_experience,
                  care_difficulty: animal.care_difficulty,
                  health_status: animal.health_status,
                }}
              />
            </div>
            <div className="p-5">
              <div className="font-display text-xl font-bold text-ink-900">{animal.name}</div>
              <div className="text-sm text-ink-500">
                {[animal.breed ?? SPECIES_LABEL[animal.species], animalAgeLabel(animal), animal.sex !== "unknown" ? SEX_LABEL[animal.sex] : null].filter(Boolean).join(" · ")}
              </div>
              {inst && (
                <div className="mt-2 text-[13px] font-bold text-terracotta-600">
                  🏠 {inst.name}{inst.city ? ` · ${inst.city}` : ""}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-cream-warm p-5 ring-1 ring-ink-900/8">
            <h4 className="font-display text-sm font-bold text-ink-900">Co bude dál?</h4>
            <ol className="mt-3 space-y-2.5">
              {[
                "Útulek dostane tvůj zájem a ozve se ti.",
                `Domluvíte si setkání s ${animal.name}.`,
                "Když to klikne, podepíšete smlouvu.",
              ].map((s, i) => (
                <li key={i} className="flex items-start gap-2.5 text-[13px] font-semibold text-ink-600">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-terracotta-500 text-[11px] font-bold text-cream">
                    {i + 1}
                  </span>
                  {s}
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

async function loadQuestions(
  supabase: SupabaseServerClient,
  animal: AnimalRow,
): Promise<ApplicationQuestionRow[]> {
  // institution_id z animals (nezískané v public selectu) → přes slug.
  if (!animal.institution) return [];
  const { data: inst } = await supabase
    .from("institutions")
    .select("id")
    .eq("slug", animal.institution.slug)
    .maybeSingle();
  const instId = (inst as { id: string } | null)?.id;
  if (!instId) return [];

  const { data } = await supabase
    .from("application_questions")
    .select("*")
    .eq("institution_id", instId)
    .eq("active", true)
    .order("sort_order", { ascending: true });

  return ((data ?? []) as ApplicationQuestionRow[]).filter(
    (q) => q.species.length === 0 || q.species.includes(animal.species),
  );
}
