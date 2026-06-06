import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Calendar, Cat, ChevronLeft, Clock, Dog, Heart, Home, MapPin, Sparkles, Stethoscope } from "lucide-react";

import { ZozioBadge } from "@/components/zozio/badge";
import { ZozioButton } from "@/components/zozio/button";
import { createClient } from "@/lib/supabase/server";
import { ENERGY_LABEL, SEX_LABEL, SIZE_LABEL, SPECIES_LABEL } from "@/lib/format";
import { animalAgeLabel } from "@/lib/animal-age";
import { idealHome } from "@/lib/ideal-home";

import { AnimalShare } from "./share";
import { ViewTracker } from "./view-tracker";
import { Gallery } from "./gallery";
import { AnimalMatch } from "./animal-match";
import { SimilarAnimals } from "./similar-animals";
import { IdealHomeSection } from "./ideal-home-section";
import {
  loadAnimal,
  loadInterestCount,
  loadSimilar,
  type AnimalDetail,
} from "./query";
import { loadAdopterPreferences } from "../../adopt/matching-actions";

export const revalidate = 60;

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const animal = await loadAnimal(supabase, id);
  if (!animal) return { title: "Zvíře nenalezeno — Zozio" };

  const title = `${animal.name} — ${animal.breed ?? SPECIES_LABEL[animal.species] ?? "Zvíře"} k adopci · Zozio`;
  const description =
    (animal.story_text || animal.description)?.slice(0, 160) ??
    `${animal.name} hledá nový domov v útulku ${animal.institution?.name ?? ""}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: animal.primary_photo_url ? [animal.primary_photo_url] : [],
      type: "article",
    },
  };
}

function daysSince(iso: string | null): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}
function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
}

export default async function AnimalPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const animal = await loadAnimal(supabase, id);
  if (!animal) notFound();

  // Ochranná lhůta → výhradně katalog nalezenců (neobcházet přímým odkazem).
  if (animal.legal_status === "in_protection") {
    if (animal.found_listing_published) redirect(`/nalezenci/${id}`);
    notFound();
  }

  const inst = animal.institution;
  const photos = [animal.primary_photo_url, ...(animal.gallery ?? [])].filter(
    (x): x is string => Boolean(x),
  );

  const [interestCount, similar, savedPrefs] = await Promise.all([
    loadInterestCount(animal.id),
    loadSimilar(supabase, animal),
    loadAdopterPreferences(),
  ]);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const state = adoptionState(animal);
  const ideal = idealHome(animal);
  const waited = daysSince(animal.intake_date);
  const fosterAlso = state.key === "available" && inst?.foster_enabled;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: animal.name,
    description: animal.description,
    image: photos,
    category: SPECIES_LABEL[animal.species],
    brand: inst?.name ? { "@type": "Organization", name: inst.name } : undefined,
    offers: {
      "@type": "Offer",
      availability:
        animal.adoption_status === "available"
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      price: String(inst?.adoption_fee_default ?? 0),
      priceCurrency: "CZK",
    },
  };

  return (
    <>
      <ViewTracker animalId={animal.id} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div className="border-b border-ink-900/8 bg-cream-warm">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <Link href="/adopt" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-terracotta-600">
            <ChevronLeft className="size-4" /> Zpět na katalog
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid gap-9 lg:grid-cols-[1.45fr_1fr]">
          {/* HLAVNÍ */}
          <div className="min-w-0 space-y-7">
            <Gallery photos={photos} name={animal.name} urgent={animal.is_urgent} />

            {/* Titulek */}
            <header className="space-y-2.5">
              <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-ink-900 md:text-5xl">
                Ahoj, jsem {animal.name}.
              </h1>
              <p className="text-base font-bold text-ink-500">
                {[
                  animal.breed,
                  animalAgeLabel(animal),
                  animal.sex !== "unknown" ? SEX_LABEL[animal.sex] : null,
                  inst?.city,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className="text-base text-ink-600">
                {animal.story_text
                  ? (animal.description || "").slice(0, 160) ||
                    `${animal.name} hledá nový domov.`
                  : `${animal.name} hledá nový domov${inst?.name ? ` z útulku ${inst.name}` : ""}.`}
              </p>
              {animal.intake_date && (
                <p className="inline-flex items-center gap-1.5 text-sm font-bold text-ink-500">
                  <Clock className="size-4" /> V péči od {fmtDate(animal.intake_date)}
                  {waited != null && ` · čeká ${waited} ${waited === 1 ? "den" : waited < 5 ? "dny" : "dní"}`}
                </p>
              )}
            </header>

            {/* Info karty */}
            <section className="grid gap-3.5 sm:grid-cols-2">
              <InfoCard icon={<SpeciesIcon species={animal.species} />} label="Druh & plemeno">
                <p className="font-display text-lg font-bold text-ink-900">{SPECIES_LABEL[animal.species] ?? animal.species}</p>
                {animal.breed && (
                  <p className="text-sm text-ink-500">
                    {animal.is_crossbreed ? "Kříženec " : ""}
                    {animal.breed}
                    {animal.breed_secondary ? ` × ${animal.breed_secondary}` : ""}
                  </p>
                )}
                {animal.color && <p className="text-sm text-ink-500">Barva: {animal.color}</p>}
              </InfoCard>

              <InfoCard icon={<Calendar className="size-5" />} label="Věk & velikost">
                <p className="font-display text-lg font-bold text-ink-900">{animalAgeLabel(animal)}</p>
                <p className="text-sm text-ink-500">
                  {[animal.size ? SIZE_LABEL[animal.size] : null, animal.weight_kg ? `${animal.weight_kg} kg` : null].filter(Boolean).join(" · ")}
                </p>
              </InfoCard>

              <InfoCard icon={<Stethoscope className="size-5" />} label="Zdraví & péče">
                <div className="flex flex-wrap gap-1.5">
                  {animal.is_vaccinated && <ZozioBadge variant="available" size="sm">✓ Očkováno</ZozioBadge>}
                  {animal.is_neutered === true && <ZozioBadge variant="available" size="sm">✓ Kastrováno</ZozioBadge>}
                  {animal.is_chipped && <ZozioBadge variant="available" size="sm">✓ Čipováno</ZozioBadge>}
                  {animal.health_status === "special_needs" && <ZozioBadge variant="urgent" size="sm">Speciální péče</ZozioBadge>}
                </div>
                <p className="text-sm text-ink-500">
                  Speciální péče: {animal.health_status === "special_needs" ? animal.health_notes || "ano" : "bez omezení"}
                </p>
              </InfoCard>

              <InfoCard icon={<Sparkles className="size-5" />} label="Povaha & lifestyle">
                <p className="text-sm text-ink-600">
                  {[
                    animal.energy_level ? `${ENERGY_LABEL[animal.energy_level]} energie` : null,
                    animal.care_difficulty === "easy" ? "Nízká náročnost" : animal.care_difficulty === "medium" ? "Střední náročnost" : animal.care_difficulty === "high" ? "Vysoká náročnost" : null,
                    animal.suitable_housing === "apartment" ? "Vhodný do bytu" : animal.suitable_housing === "house" ? "Vhodný do domu" : animal.suitable_housing === "both" ? "Byt i dům" : null,
                  ].filter(Boolean).join(" · ")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Compat label="Děti" value={animal.good_with_children} />
                  <Compat label="Psi" value={animal.good_with_dogs} />
                  <Compat label="Kočky" value={animal.good_with_cats} />
                </div>
              </InfoCard>
            </section>

            {/* Příběh */}
            {(animal.story_text || animal.description) && (
              <section className="rounded-3xl bg-card p-6 ring-1 ring-ink-900/8">
                <h2 className="mb-3 font-display text-xl font-bold text-ink-900">
                  {animal.story_title || "Můj příběh"}
                </h2>
                <p className="whitespace-pre-line leading-relaxed text-ink-700">
                  {animal.story_text || animal.description}
                </p>
              </section>
            )}

            {/* Ideální domov (deterministické + AI cache) */}
            <IdealHomeSection animalId={animal.id} base={ideal} />

            {/* Štítky */}
            {animal.personality_tags?.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-display text-xl font-bold text-ink-900">Štítky</h2>
                <div className="flex flex-wrap gap-2">
                  {animal.personality_tags.map((tag) => (
                    <ZozioBadge key={tag} variant="soft">{tag}</ZozioBadge>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* SIDEBAR */}
          <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
            <AnimalMatch
              name={animal.name}
              isLoggedIn={!!user}
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

            {/* Adopce */}
            <div className="rounded-3xl bg-card p-6 ring-1 ring-ink-900/8">
              <div className={`mb-3 inline-flex items-center gap-2 text-sm font-bold ${state.color}`}>
                <span className={`size-2.5 rounded-full ${state.dot}`} /> {state.label}
              </div>
              {state.key === "available" && interestCount > 0 && (
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-pill bg-peach-100 px-3 py-1 text-[13px] font-bold text-terracotta-600">
                  ❤️ {interestCount} {interestCount === 1 ? "člověk už projevil" : interestCount < 5 ? "lidé už projevili" : "lidí už projevilo"} zájem
                </div>
              )}
              <h3 className="font-display text-xl font-bold text-ink-900">{state.heading(animal.name, animal.sex)}</h3>
              <p className="mt-1.5 text-sm text-ink-500">{state.sub(animal.name, animal.sex)}</p>

              {state.disabled ? (
                <div className="mt-4 w-full rounded-pill bg-cream-warm px-5 py-3.5 text-center text-sm font-bold text-ink-500">
                  {state.cta}
                </div>
              ) : (
                <ZozioButton asChild variant="meadow" size="lg" className="mt-4 w-full">
                  <Link href={state.href(animal.id)}>
                    {state.icon} {state.cta}
                  </Link>
                </ZozioButton>
              )}

              <AnimalShare animal={animal} className="mt-3" />

              {fosterAlso && (
                <div className="mt-4 flex items-center gap-3 rounded-2xl border border-dashed border-sunshine-400 bg-sunshine-200/30 p-3">
                  <div className="flex-1">
                    <div className="text-[13px] font-bold text-sunshine-600">🏡 Hledá i dočasnou péči</div>
                    <div className="text-[11px] font-semibold text-ink-500">Nemůžeš trvale? Vezmi {animal.sex === "female" ? "ji" : "ho"} na přechodnou dobu.</div>
                  </div>
                  <Link
                    href={`/animals/${animal.id}/zajem?typ=foster`}
                    className="shrink-0 rounded-pill border border-sunshine-400 bg-sunshine-200/60 px-3.5 py-2 text-[13px] font-bold text-sunshine-600 hover:bg-sunshine-200"
                  >
                    Nabídnout
                  </Link>
                </div>
              )}

              {inst?.adoption_fee_default != null && inst.adoption_fee_default > 0 && (
                <div className="mt-4 rounded-2xl bg-cream-warm p-3.5">
                  <div className="text-xs font-bold text-ink-400">Adopční poplatek</div>
                  <div className="font-display text-lg font-bold text-ink-900">
                    {inst.adoption_fee_default.toLocaleString("cs-CZ")} Kč
                  </div>
                  <div className="text-xs font-semibold text-ink-500">Obvykle zahrnuje čip, očkování a kastraci.</div>
                </div>
              )}
            </div>

            {/* Útulek */}
            {inst && (
              <div className="rounded-3xl bg-card p-6 ring-1 ring-ink-900/8">
                <span className="inline-block rounded-pill bg-peach-100 px-2.5 py-0.5 text-[11px] font-bold text-terracotta-600">V péči</span>
                <h3 className="mt-2.5 font-display text-lg font-bold text-ink-900">{inst.name}</h3>
                {inst.city && (
                  <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-ink-500">
                    <MapPin className="size-4" /> {inst.city}{inst.region && inst.region !== inst.city ? `, ${inst.region}` : ""}
                  </p>
                )}
                {inst.description && (
                  <p className="mt-3 text-sm leading-relaxed text-ink-600">
                    {inst.description.slice(0, 180)}{inst.description.length > 180 ? "…" : ""}
                  </p>
                )}
                <Link href={`/utulek/${inst.slug}`} className="mt-3 inline-block text-sm font-bold text-terracotta-600 hover:text-terracotta-500">
                  Profil útulku →
                </Link>
                {inst.opening_hours && (
                  <p className="mt-3 border-t border-ink-900/8 pt-3 text-xs font-semibold text-ink-500">
                    <Home className="mr-1 inline size-3.5" /> Návštěvy: {inst.opening_hours}
                  </p>
                )}
              </div>
            )}
          </aside>
        </div>

        {/* Podobná */}
        <SimilarAnimals items={similar} initialPrefs={savedPrefs} />
      </div>
    </>
  );
}

// ---- stavová logika -----------------------------------------------------

interface StateView {
  key: "available" | "reserved" | "trial" | "adopted" | "foster" | "unavailable";
  label: string;
  color: string;
  dot: string;
  icon: string;
  cta: string;
  disabled: boolean;
  href: (id: string) => string;
  heading: (name: string, sex: string) => string;
  sub: (name: string, sex: string) => string;
}

function adoptionState(a: AnimalDetail): StateView {
  const her = (sex: string) => (sex === "female" ? "ji" : "ho");
  switch (a.adoption_status) {
    case "available":
      return {
        key: "available", label: "K dispozici k adopci", color: "text-fern-700", dot: "bg-fern-600",
        icon: "❤️", cta: "Mám zájem o adopci", disabled: false,
        href: (id) => `/animals/${id}/zajem`,
        heading: (n) => `Zaujal${a.sex === "female" ? "a" : ""} tě?`,
        sub: (n, s) => `Pošli ${her(s)} přátelskou zprávu — útulek se ti ozve.`,
      };
    case "reserved":
      return {
        key: "reserved", label: "Rezervováno", color: "text-sunshine-600", dot: "bg-sunshine-400",
        icon: "📝", cta: "Přidat se jako náhradník", disabled: false,
        href: (id) => `/animals/${id}/zajem`,
        heading: () => "Někdo už je ve hře",
        sub: () => "Můžeš se přidat jako náhradník, kdyby to nevyšlo.",
      };
    case "foster":
      return {
        key: "foster", label: "🏡 Hledá dočasnou péči", color: "text-sunshine-600", dot: "bg-sunshine-400",
        icon: "🏡", cta: "Nabídnout dočasnou péči", disabled: false,
        href: (id) => `/animals/${id}/zajem?typ=foster`,
        heading: (n) => `${n} potřebuje pěstouna`,
        sub: () => "Vezmi si ho na přechodnou dobu, než najde trvalý domov.",
      };
    case "on_hold":
      return {
        key: "trial", label: "Zkušební péče", color: "text-sunshine-600", dot: "bg-sunshine-400",
        icon: "", cta: "Nové žádosti pozastaveny", disabled: true,
        href: (id) => `/adopt`,
        heading: (n) => `${n} je na zkoušku u zájemce`,
        sub: () => "Zatím nepřijímáme nové žádosti. Sleduj, jak to dopadne.",
      };
    case "adopted":
      return {
        key: "adopted", label: "🎉 Adoptováno", color: "text-ink-500", dot: "bg-ink-400",
        icon: "🐾", cta: "Procházet ostatní zvířata", disabled: false,
        href: () => `/adopt`,
        heading: (n) => `${n} našl${a.sex === "female" ? "a" : "a"} domov!`,
        sub: () => "Tahle adopce dopadla šťastně. Podívej se na ostatní.",
      };
    default:
      return {
        key: "unavailable", label: "Není k dispozici", color: "text-ink-500", dot: "bg-ink-400",
        icon: "🐾", cta: "Procházet ostatní zvířata", disabled: false,
        href: () => `/adopt`,
        heading: (n) => `${n} momentálně není k adopci`,
        sub: () => "Podívej se na ostatní zvířata, která hledají domov.",
      };
  }
}

// ---- malé komponenty ----------------------------------------------------

function InfoCard({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2.5 rounded-2xl bg-card p-4 ring-1 ring-ink-900/8">
      <div className="flex items-center gap-2 text-ink-400">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function SpeciesIcon({ species }: { species: AnimalDetail["species"] }) {
  if (species === "dog") return <Dog className="size-5" />;
  if (species === "cat") return <Cat className="size-5" />;
  return <Sparkles className="size-5" />;
}

function Compat({ label, value }: { label: string; value: AnimalDetail["good_with_children"] }) {
  const ok = value === "yes";
  const no = value === "no";
  return (
    <span
      className={`rounded-pill px-2.5 py-1 text-xs font-bold ${
        ok ? "bg-fern-50 text-fern-700" : no ? "bg-peach-100 text-terracotta-600" : "bg-cream-warm text-ink-400"
      }`}
    >
      {label} {ok ? "✓" : no ? "✗" : "?"}
    </span>
  );
}
