import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ChevronLeft,
  MapPin,
  CalendarClock,
  Phone,
  Mail,
  AlertCircle,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { SPECIES_LABEL, SEX_LABEL } from "@/lib/format";
import { animalAgeLabel } from "@/lib/animal-age";
import type { Sex, Species } from "@/types/database";

interface FoundDetail {
  id: string;
  name: string;
  species: Species;
  sex: Sex;
  breed: string | null;
  color: string | null;
  age_years: number | null;
  age_months: number | null;
  birth_date: string | null;
  primary_photo_url: string | null;
  found_location: string | null;
  found_date: string | null;
  announced_at: string | null;
  protection_until: string | null;
  intake_condition: string | null;
  institution: {
    name: string;
    slug: string;
    city: string | null;
    phone: string | null;
    email: string | null;
  } | null;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

function fmtDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("cs-CZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

async function loadAnimal(id: string): Promise<FoundDetail | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("animals")
    .select(
      `id, name, species, sex, breed, color, age_years, age_months, birth_date,
       primary_photo_url, found_location, found_date, announced_at,
       protection_until, intake_condition,
       institution:institutions!inner(name, slug, city, phone, email, is_published)`,
    )
    .eq("id", id)
    .eq("found_listing_published", true)
    .eq("legal_status", "in_protection")
    .in("intake_type", ["found", "confiscation"])
    .eq("institutions.is_published", true)
    .maybeSingle();

  return (data as unknown as FoundDetail) ?? null;
}

export async function generateMetadata({ params }: PageProps) {
  const { id } = await params;
  const animal = await loadAnimal(id);
  if (!animal) return { title: "Nalezené zvíře · Zozio" };
  return {
    title: `${animal.name} — hledá svého páníčka · Zozio`,
    description: `Nalezené zvíře v ochranné lhůtě${
      animal.found_location ? ` (${animal.found_location})` : ""
    }. Poznáváte své zvíře? Kontaktujte útulek.`,
    robots: { index: true },
  };
}

export default async function FoundAnimalDetailPage({ params }: PageProps) {
  const { id } = await params;
  const animal = await loadAnimal(id);
  if (!animal) notFound();

  const inst = animal.institution;
  const until = fmtDate(animal.protection_until);
  const found = fmtDate(animal.found_date);

  const facts: Array<{ label: string; value: string }> = [];
  facts.push({ label: "Druh", value: SPECIES_LABEL[animal.species] ?? "—" });
  if (animal.breed) facts.push({ label: "Plemeno", value: animal.breed });
  if (animal.sex !== "unknown")
    facts.push({ label: "Pohlaví", value: SEX_LABEL[animal.sex] });
  facts.push({ label: "Věk (odhad)", value: animalAgeLabel(animal) });
  if (animal.color) facts.push({ label: "Barva", value: animal.color });

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href="/nalezenci"
        className="inline-flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-meadow-700"
      >
        <ChevronLeft className="size-4" /> Zpět na nalezená zvířata
      </Link>

      <div className="mt-6 grid gap-8 md:grid-cols-2">
        <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-cream-warm ring-1 ring-ink-900/8">
          {animal.primary_photo_url ? (
            <Image
              src={animal.primary_photo_url}
              alt={animal.name}
              fill
              sizes="(min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="flex size-full items-center justify-center text-6xl">
              🐾
            </div>
          )}
          <div className="absolute left-4 top-4">
            <span className="rounded-pill bg-sunshine-200 px-3 py-1 text-xs font-semibold text-sunshine-600">
              V ochranné lhůtě
            </span>
          </div>
        </div>

        <div>
          <div className="font-mono text-xs uppercase tracking-wider text-meadow-700">
            Hledá svého páníčka
          </div>
          <h1 className="mt-1 font-display text-4xl font-bold leading-tight text-ink-900">
            {animal.name}
          </h1>

          <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-400">
                  {f.label}
                </dt>
                <dd className="text-sm text-ink-900">{f.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-6 space-y-2 rounded-2xl bg-cream p-4 ring-1 ring-ink-900/8">
            {animal.found_location && (
              <div className="flex items-start gap-2 text-sm text-ink-700">
                <MapPin className="mt-0.5 size-4 shrink-0 text-ink-400" />
                <span>
                  Nalezeno: <strong>{animal.found_location}</strong>
                  {found ? ` — ${found}` : ""}
                </span>
              </div>
            )}
            {until && (
              <div className="flex items-start gap-2 text-sm text-ink-700">
                <CalendarClock className="mt-0.5 size-4 shrink-0 text-ink-400" />
                <span>
                  Ochranná lhůta běží do <strong>{until}</strong>
                </span>
              </div>
            )}
          </div>

          {animal.intake_condition && (
            <p className="mt-4 text-sm text-ink-700">
              {animal.intake_condition}
            </p>
          )}
        </div>
      </div>

      {/* Důležité: NENÍ k adopci */}
      <div className="mt-8 flex items-start gap-3 rounded-3xl bg-peach-100 p-6 ring-1 ring-inset ring-peach-300">
        <AlertCircle className="mt-0.5 size-5 shrink-0 text-terracotta-600" />
        <div>
          <h2 className="font-display text-lg font-bold text-terracotta-600">
            Toto zvíře není k adopci
          </h2>
          <p className="mt-1 text-sm text-ink-700">
            Probíhá zákonná ochranná lhůta, během které se může přihlásit
            původní majitel. Po jejím skončení útulek rozhodne o dalším osudu
            zvířete — teprve potom může být případně nabídnuto k adopci.
          </p>
        </div>
      </div>

      {/* Kontakt na útulek */}
      <div className="mt-6 rounded-3xl bg-sage-50 p-6 ring-1 ring-inset ring-ink-900/8">
        <h2 className="font-display text-xl font-bold text-ink-900">
          Poznáváte své zvíře?
        </h2>
        <p className="mt-1 text-sm text-ink-700">
          Ozvěte se co nejdřív útulku, který zvíře eviduje. Připravte si doklad
          o vlastnictví nebo identifikaci (čip, fotografie).
        </p>
        {inst && (
          <div className="mt-4 space-y-2">
            <Link
              href={`/utulek/${inst.slug}`}
              className="font-semibold text-meadow-700 hover:text-meadow-600"
            >
              {inst.name}
              {inst.city ? ` · ${inst.city}` : ""}
            </Link>
            <div className="flex flex-wrap gap-4 text-sm">
              {inst.phone && (
                <a
                  href={`tel:${inst.phone}`}
                  className="inline-flex items-center gap-1.5 text-ink-700 hover:text-meadow-700"
                >
                  <Phone className="size-4" /> {inst.phone}
                </a>
              )}
              {inst.email && (
                <a
                  href={`mailto:${inst.email}`}
                  className="inline-flex items-center gap-1.5 text-ink-700 hover:text-meadow-700"
                >
                  <Mail className="size-4" /> {inst.email}
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
