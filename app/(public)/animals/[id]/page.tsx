import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Calendar,
  Cat,
  ChevronLeft,
  Dog,
  Heart,
  MapPin,
  Sparkles,
  Stethoscope,
} from "lucide-react";

import { ZozioBadge } from "@/components/zozio/badge";
import { ZozioButton } from "@/components/zozio/button";
import { createClient } from "@/lib/supabase/server";
import {
  ENERGY_LABEL,
  SEX_LABEL,
  SIZE_LABEL,
  SPECIES_LABEL,
} from "@/lib/format";
import { animalAgeLabel } from "@/lib/animal-age";

import { AnimalShare } from "./share";
import { loadAnimal, type AnimalDetail } from "./query";

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
    animal.description?.slice(0, 160) ??
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

export default async function AnimalPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const animal = await loadAnimal(supabase, id);

  if (!animal) notFound();

  // Zvíře v ochranné lhůtě se nenabízí k adopci — patří do katalogu nalezenců.
  // Pokud ho útulek zveřejnil, přesměruj na jeho stránku „Hledají páníčka".
  if (animal.legal_status === "in_protection" && animal.found_listing_published) {
    redirect(`/nalezenci/${id}`);
  }

  const inst = animal.institution;
  const gallery = animal.gallery?.length ? animal.gallery : [];
  const photos = [animal.primary_photo_url, ...gallery].filter(
    (x): x is string => Boolean(x),
  );

  // JSON-LD structured data
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
      price: "0",
      priceCurrency: "CZK",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Back link */}
      <div className="border-b border-ink-900/8 bg-cream-warm">
        <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6">
          <Link
            href="/adopt"
            className="inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-meadow-700"
          >
            <ChevronLeft className="size-4" /> Zpět na katalog
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          {/* Left: Hero + content */}
          <div className="min-w-0 space-y-8">
            {/* Gallery */}
            <Gallery photos={photos} name={animal.name} />

            {/* Headline */}
            <header className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {animal.is_urgent && (
                  <ZozioBadge variant="urgent">Naléhá</ZozioBadge>
                )}
                {animal.long_stay_boost && !animal.is_urgent && (
                  <ZozioBadge variant="longStay">Dlouho čeká</ZozioBadge>
                )}
                {animal.adoption_status === "reserved" && (
                  <ZozioBadge variant="reserved">Rezervováno</ZozioBadge>
                )}
                {animal.adoption_status === "adopted" && (
                  <ZozioBadge variant="adopted">Adoptováno</ZozioBadge>
                )}
              </div>

              <h1 className="font-display text-5xl font-bold leading-[0.95] tracking-tight text-ink-900 md:text-7xl">
                Ahoj, jsem{" "}
                <span className="italic text-meadow-700">{animal.name}.</span>
              </h1>

              <p className="text-lg text-ink-600">
                {[
                  animal.breed,
                  animalAgeLabel(animal),
                  animal.sex !== "unknown" ? SEX_LABEL[animal.sex] : null,
                  inst?.city,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </header>

            {/* Story / description */}
            {(animal.story_text || animal.description) && (
              <section className="rounded-3xl bg-cream-warm p-6 ring-1 ring-ink-900/5 md:p-8">
                {animal.story_title && (
                  <h2 className="mb-3 font-display text-2xl font-bold text-ink-900">
                    {animal.story_title}
                  </h2>
                )}
                <p className="whitespace-pre-line text-base leading-relaxed text-ink-700">
                  {animal.story_text || animal.description}
                </p>
              </section>
            )}

            {/* Attributes grid */}
            <section className="grid gap-4 sm:grid-cols-2">
              <AttrCard
                icon={<SpeciesIcon species={animal.species} />}
                label="Druh & plemeno"
              >
                <p className="font-display text-xl font-semibold text-ink-900">
                  {SPECIES_LABEL[animal.species] ?? animal.species}
                </p>
                {animal.breed && (
                  <p className="text-sm text-ink-600">
                    {animal.is_crossbreed ? "Kříženec " : ""}
                    {animal.breed}
                    {animal.breed_secondary ? ` × ${animal.breed_secondary}` : ""}
                  </p>
                )}
              </AttrCard>

              <AttrCard
                icon={<Calendar className="size-5" />}
                label="Věk & velikost"
              >
                <p className="font-display text-xl font-semibold text-ink-900">
                  {animalAgeLabel(animal)}
                </p>
                <p className="text-sm text-ink-600">
                  {[
                    animal.size ? SIZE_LABEL[animal.size] : null,
                    animal.weight_kg ? `${animal.weight_kg} kg` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </AttrCard>

              <AttrCard
                icon={<Stethoscope className="size-5" />}
                label="Zdraví"
              >
                <div className="flex flex-wrap gap-1.5">
                  <ZozioBadge variant={animal.is_vaccinated ? "available" : "outline"} size="sm">
                    {animal.is_vaccinated ? "✓ Očkováno" : "Bez očkování"}
                  </ZozioBadge>
                  {animal.is_neutered === true && (
                    <ZozioBadge variant="soft" size="sm">✓ Kastrováno</ZozioBadge>
                  )}
                  {animal.is_chipped && (
                    <ZozioBadge variant="soft" size="sm">✓ Čipováno</ZozioBadge>
                  )}
                  {animal.health_status === "special_needs" && (
                    <ZozioBadge variant="urgent" size="sm">Handicap</ZozioBadge>
                  )}
                </div>
                {animal.health_notes && (
                  <p className="mt-2 text-sm text-ink-600">
                    {animal.health_notes}
                  </p>
                )}
              </AttrCard>

              <AttrCard
                icon={<Sparkles className="size-5" />}
                label="Povaha & lifestyle"
              >
                <p className="text-sm text-ink-700">
                  {[
                    animal.energy_level
                      ? `${ENERGY_LABEL[animal.energy_level]} energie`
                      : null,
                    animal.care_difficulty === "easy"
                      ? "Nízká náročnost"
                      : animal.care_difficulty === "medium"
                        ? "Střední náročnost"
                        : animal.care_difficulty === "high"
                          ? "Vysoká náročnost"
                          : null,
                    animal.suitable_housing === "apartment"
                      ? "Vhodný do bytu"
                      : animal.suitable_housing === "house"
                        ? "Vhodný do domu"
                        : animal.suitable_housing === "both"
                          ? "Byt i dům"
                          : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <CompatibilityRow
                  label="Děti"
                  value={animal.good_with_children}
                />
                <CompatibilityRow label="Psi" value={animal.good_with_dogs} />
                <CompatibilityRow label="Kočky" value={animal.good_with_cats} />
              </AttrCard>
            </section>

            {/* Personality tags */}
            {animal.personality_tags?.length > 0 && (
              <section className="space-y-3">
                <h2 className="font-display text-xl font-bold text-ink-900">
                  Štítky
                </h2>
                <div className="flex flex-wrap gap-2">
                  {animal.personality_tags.map((tag) => (
                    <ZozioBadge key={tag} variant="soft">
                      {tag}
                    </ZozioBadge>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right: sticky CTA + shelter sidebar */}
          <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
            {/* Primary CTA */}
            <div className="rounded-3xl bg-meadow-500 p-6 text-cream shadow-soft-md">
              <h3 className="font-display text-2xl font-bold leading-tight">
                Zaujal{animal.sex === "female" ? "a" : ""} tě?
              </h3>
              <p className="mt-2 text-sm text-cream/90">
                {animal.adoption_status === "available"
                  ? `Pošli ${animal.sex === "female" ? "ji" : "mu"} přátelskou zprávu — útulek se ti ozve.`
                  : `${animal.name} už není k dispozici, ale podívej se na ostatní zvířata.`}
              </p>
              <ZozioButton
                asChild
                variant="sunshine"
                size="lg"
                className="mt-5 w-full"
                disabled={animal.adoption_status !== "available"}
              >
                <Link
                  href={
                    animal.adoption_status === "available"
                      ? `/animals/${animal.id}/zajem`
                      : "/adopt"
                  }
                >
                  <Heart />{" "}
                  {animal.adoption_status === "available"
                    ? "Mám zájem o adopci"
                    : "Procházet ostatní zvířata"}
                </Link>
              </ZozioButton>
              <AnimalShare animal={animal} className="mt-4" />
            </div>

            {/* Institution */}
            {inst && (
              <div className="rounded-3xl bg-cream p-6 ring-1 ring-ink-900/8">
                <div className="font-mono text-xs uppercase tracking-wider text-meadow-700">
                  V péči
                </div>
                <h3 className="mt-2 font-display text-2xl font-bold text-ink-900">
                  {inst.name}
                </h3>
                {inst.city && (
                  <p className="mt-1 inline-flex items-center gap-1 text-sm text-ink-600">
                    <MapPin className="size-4" /> {inst.city}
                    {inst.region && inst.region !== inst.city
                      ? `, ${inst.region}`
                      : ""}
                  </p>
                )}
                {inst.description && (
                  <p className="mt-4 text-sm leading-relaxed text-ink-700">
                    {inst.description.slice(0, 200)}
                    {inst.description.length > 200 ? "…" : ""}
                  </p>
                )}
                <div className="mt-5 flex flex-col gap-2">
                  <ZozioButton asChild variant="outline" size="md">
                    <Link href={`/utulek/${inst.slug}`}>
                      Profil útulku
                    </Link>
                  </ZozioButton>
                  {inst.website && (
                    <a
                      href={inst.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-center text-sm font-semibold text-ink-600 hover:text-meadow-700"
                    >
                      {new URL(inst.website).host} ↗
                    </a>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

// ---- Sub-components -----------------------------------------------------

function Gallery({ photos, name }: { photos: string[]; name: string }) {
  if (photos.length === 0) {
    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-3xl bg-cream-warm text-6xl">
        🐾
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-cream-warm">
        <Image
          src={photos[0]}
          alt={name}
          fill
          sizes="(min-width: 1024px) 60vw, 100vw"
          priority
          className="object-cover"
        />
      </div>
      {photos.length > 1 && (
        <div className="grid grid-cols-4 gap-2">
          {photos.slice(1, 5).map((p, i) => (
            <div
              key={p}
              className="relative aspect-square overflow-hidden rounded-xl bg-cream-warm"
            >
              <Image
                src={p}
                alt={`${name} foto ${i + 2}`}
                fill
                sizes="20vw"
                className="object-cover"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AttrCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3 rounded-2xl bg-cream p-5 ring-1 ring-ink-900/8">
      <div className="flex items-center gap-2 text-ink-600">
        {icon}
        <span className="font-mono text-xs uppercase tracking-wider">
          {label}
        </span>
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

function CompatibilityRow({
  label,
  value,
}: {
  label: string;
  value: AnimalDetail["good_with_children"];
}) {
  const icon =
    value === "yes" ? "✓" : value === "no" ? "✗" : "?";
  const tone =
    value === "yes"
      ? "text-meadow-700"
      : value === "no"
        ? "text-terracotta-600"
        : "text-ink-400";
  return (
    <div className="flex items-center justify-between border-t border-ink-900/5 pt-1 text-sm">
      <span className="text-ink-600">{label}</span>
      <span className={`font-semibold ${tone}`}>{icon}</span>
    </div>
  );
}
