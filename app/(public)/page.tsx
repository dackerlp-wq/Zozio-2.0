import Link from "next/link";
import { ArrowRight, PawPrint, Search, Sparkles } from "lucide-react";

import { AnimalCard, type AnimalCardData } from "@/components/zozio/animal-card";
import { ZozioButton } from "@/components/zozio/button";
import { createClient } from "@/lib/supabase/server";
import { ageLabel } from "@/lib/format";
import type { AdoptionStatus, Species } from "@/types/database";

interface AnimalListRow {
  id: string;
  name: string;
  species: Species;
  breed: string | null;
  age_years: number | null;
  age_months: number | null;
  primary_photo_url: string | null;
  adoption_status: AdoptionStatus;
  is_urgent: boolean;
  long_stay_boost: boolean;
  personality_tags: string[];
  institution: { name: string; city: string | null } | null;
}

export const revalidate = 60;

export const metadata = {
  title: "Zozio — najdi parťáka na celý život",
  description:
    "Adopce, která tě chytne za srdce. A za tlapku. Tisíce zvířat z útulků v ČR a SK čeká na nový domov.",
};

export default async function LandingPage() {
  const supabase = await createClient();

  const [{ count: animalsAvailable }, { count: institutionsCount }, featured] =
    await Promise.all([
      supabase
        .from("animals")
        .select("*", { count: "exact", head: true })
        .eq("adoption_status", "available"),
      supabase
        .from("institutions")
        .select("*", { count: "exact", head: true })
        .eq("is_published", true),
      supabase
        .from("animals")
        .select(
          "id, name, species, breed, age_years, age_months, primary_photo_url, adoption_status, is_urgent, long_stay_boost, personality_tags, institution:institutions!inner(name, city)",
        )
        .eq("adoption_status", "available")
        .eq("institutions.is_published", true)
        .order("is_urgent", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(8),
    ]);

  const featuredRows = (featured.data ?? []) as unknown as AnimalListRow[];

  const cards: AnimalCardData[] = featuredRows
    .filter((a) => a.species === "dog" || a.species === "cat" || a.species === "other")
    .map((a) => ({
      id: a.id,
      name: a.name,
      species: a.species as "dog" | "cat" | "other",
      breed: a.breed ?? "—",
      ageLabel: ageLabel(a.age_years, a.age_months),
      city: a.institution?.city ?? "",
      shelterName: a.institution?.name ?? "",
      photoUrl: a.primary_photo_url ?? "",
      status: a.adoption_status as "available" | "reserved" | "adopted",
      isUrgent: a.is_urgent,
      isLongStay: a.long_stay_boost,
      tags: a.personality_tags ?? [],
    }));

  return (
    <>
      {/* HERO */}
      <section className="relative overflow-hidden bg-gradient-to-br from-cream via-cream-warm to-meadow-100/40">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 md:py-28 lg:grid-cols-2 lg:items-center">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-meadow-100 px-4 py-1.5 text-sm font-semibold text-meadow-700 ring-1 ring-inset ring-meadow-300/40">
              <Sparkles className="size-4" />
              <span>Nová generace adopčního portálu</span>
            </div>

            <h1 className="font-display text-5xl font-bold leading-[0.95] tracking-tight text-ink-900 md:text-7xl">
              Najdi parťáka{" "}
              <span className="italic text-meadow-700">na celý život.</span>
            </h1>

            <p className="max-w-xl text-lg leading-relaxed text-ink-600">
              Tisíce zvířat z útulků v Česku a na Slovensku čeká na svůj nový
              domov. Adopce, která tě chytne za srdce. A za tlapku.
            </p>

            <div className="flex flex-wrap gap-3">
              <ZozioButton asChild variant="meadow" size="lg">
                <Link href="/adopt">
                  <Search /> Začít hledat
                </Link>
              </ZozioButton>
              <ZozioButton asChild variant="outline" size="lg">
                <Link href="/mapa">Mapa útulků</Link>
              </ZozioButton>
            </div>
          </div>

          <BentoStats
            animalsAvailable={animalsAvailable ?? 0}
            institutionsCount={institutionsCount ?? 0}
          />
        </div>
      </section>

      {/* FEATURED ANIMALS */}
      <section className="border-t border-ink-900/8 bg-background py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-10 flex items-end justify-between gap-6">
            <div className="space-y-2">
              <div className="font-mono text-xs uppercase tracking-wider text-meadow-700">
                Právě teď na Zoziu
              </div>
              <h2 className="font-display text-4xl font-bold tracking-tight text-ink-900 md:text-5xl">
                Zvířata, která potřebují domov
              </h2>
            </div>
            <Link
              href="/adopt"
              className="hidden items-center gap-1 font-semibold text-meadow-700 hover:text-meadow-600 md:inline-flex"
            >
              Všechna zvířata <ArrowRight className="size-4" />
            </Link>
          </div>

          {cards.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((c) => (
                <AnimalCard key={c.id} animal={c} />
              ))}
            </div>
          ) : (
            <div className="rounded-3xl bg-cream-warm p-12 text-center text-ink-600">
              Zatím tu nejsou žádná zvířata. Brzy se to změní.
            </div>
          )}

          <div className="mt-10 flex justify-center md:hidden">
            <ZozioButton asChild variant="outline" size="lg">
              <Link href="/adopt">Zobrazit všechna zvířata</Link>
            </ZozioButton>
          </div>
        </div>
      </section>

      {/* FOR SHELTERS CTA */}
      <section className="border-t border-ink-900/8 bg-sage-100/50 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="grid gap-10 rounded-3xl bg-cream p-10 ring-1 ring-ink-900/8 md:p-16 lg:grid-cols-2 lg:items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-sage-100 px-4 py-1.5 text-sm font-semibold text-sage-700">
                <PawPrint className="size-4" />
                <span>Pro útulky</span>
              </div>
              <h2 className="font-display text-4xl font-bold tracking-tight text-ink-900 md:text-5xl">
                Modernizuj svůj útulek bez{" "}
                <span className="italic text-sage-700">migrace webu.</span>
              </h2>
              <p className="text-lg text-ink-600">
                Spravuj zvířata, žádosti o adopci, dobrovolníky a sbírky na
                jednom místě. Vlož embed widget na svůj stávající web — nebo
                přesměruj rovnou na Zozio.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <ZozioButton asChild variant="sage" size="lg">
                  <Link href="/pro-utulky">Zjistit víc</Link>
                </ZozioButton>
                <ZozioButton asChild variant="outline" size="lg">
                  <Link href="/auth/register?role=institution">
                    Registrace útulku
                  </Link>
                </ZozioButton>
              </div>
            </div>
            <ul className="space-y-3 text-base text-ink-700">
              {[
                "Kompletní karta zvířete s veterinární historií",
                "Adopční workflow — kanban od žádosti po smlouvu",
                "Embed widget pro tvůj stávající web",
                "AI pomocník pro psaní popisků",
                "Newsletter, statistiky, mapa, QR kódy",
              ].map((line) => (
                <li
                  key={line}
                  className="flex items-start gap-3 rounded-2xl bg-sage-50 px-4 py-3"
                >
                  <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-sage-500 text-sm text-cream">
                    ✓
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}

function BentoStats({
  animalsAvailable,
  institutionsCount,
}: {
  animalsAvailable: number;
  institutionsCount: number;
}) {
  return (
    <div className="grid grid-cols-6 gap-3 sm:gap-4">
      <div className="col-span-6 rounded-3xl bg-meadow-500 p-8 text-cream sm:col-span-4">
        <div className="font-mono text-xs uppercase tracking-wider opacity-80">
          Právě teď čeká
        </div>
        <div className="mt-2 font-display text-6xl font-bold leading-none tracking-tight md:text-7xl">
          {animalsAvailable.toLocaleString("cs-CZ")}
        </div>
        <div className="mt-3 text-base font-semibold opacity-90">
          zvířat hledá nový domov
        </div>
      </div>

      <div className="col-span-3 rounded-3xl bg-sunshine-400 p-6 text-ink-900 sm:col-span-2">
        <div className="font-mono text-[10px] uppercase tracking-wider opacity-70">
          v síti
        </div>
        <div className="mt-1 font-display text-4xl font-bold leading-none tracking-tight">
          {institutionsCount}
        </div>
        <div className="mt-2 text-sm font-semibold">útulků</div>
      </div>

      <div className="col-span-3 rounded-3xl bg-peach-200 p-6 text-terracotta-600 sm:col-span-2">
        <div className="font-mono text-[10px] uppercase tracking-wider opacity-70">
          rok
        </div>
        <div className="mt-1 font-display text-4xl font-bold leading-none tracking-tight">
          2026
        </div>
        <div className="mt-2 text-sm font-semibold">nová generace</div>
      </div>

      <div className="col-span-6 rounded-3xl bg-cream-warm p-6 ring-1 ring-ink-900/5 sm:col-span-2">
        <div className="font-mono text-[10px] uppercase tracking-wider text-ink-400">
          CZ + SK
        </div>
        <div className="mt-1 font-display text-3xl font-bold leading-none tracking-tight text-ink-900">
          🇨🇿 🇸🇰
        </div>
        <div className="mt-2 text-sm font-semibold text-ink-700">
          společná platforma
        </div>
      </div>

      <div className="col-span-6 flex items-center gap-3 rounded-3xl bg-ink-900 p-6 text-cream sm:col-span-4">
        <Sparkles className="size-7 shrink-0 text-sunshine-400" />
        <div>
          <div className="font-display text-xl font-semibold leading-tight">
            AI ti pomůže najít to pravé
          </div>
          <div className="mt-0.5 text-sm opacity-70">
            Quiz · matching · smart filtry
          </div>
        </div>
      </div>
    </div>
  );
}
