import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Cat,
  Dog,
  Heart,
  Home,
  PawPrint,
  Search,
  Sparkles,
} from "lucide-react";

import { AnimalCard, type AnimalCardData } from "@/components/zozio/animal-card";
import { ZozioButton } from "@/components/zozio/button";
import { createClient } from "@/lib/supabase/server";
import { ageLabel } from "@/lib/format";
import type { AdoptionStatus, Species } from "@/types/database";

import { NewsletterForm } from "./newsletter-form";

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

  const [
    { count: animalsAvailable },
    { count: institutionsCount },
    { count: urgentCount },
    { count: longStayCount },
    featured,
  ] = await Promise.all([
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
      .select("*", { count: "exact", head: true })
      .eq("adoption_status", "available")
      .eq("is_urgent", true),
    supabase
      .from("animals")
      .select("*", { count: "exact", head: true })
      .eq("adoption_status", "available")
      .eq("long_stay_boost", true),
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
              <span>
                {animalsAvailable ?? 0} zvířat čeká právě teď
              </span>
            </div>

            <h1 className="font-display text-5xl font-bold leading-[0.95] tracking-tight text-ink-900 md:text-7xl">
              Najdi parťáka{" "}
              <span className="italic text-meadow-700">na celý život.</span>
            </h1>

            <p className="max-w-xl text-lg leading-relaxed text-ink-600">
              Adopce, která tě chytne za srdce. A za tlapku. Procházej zvířata
              z útulků v Česku a na Slovensku a najdi to své.
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

          <HeroBento
            animalsAvailable={animalsAvailable ?? 0}
            institutionsCount={institutionsCount ?? 0}
            urgentCount={urgentCount ?? 0}
          />
        </div>
      </section>

      {/* QUICK CATEGORIES */}
      <section className="border-t border-ink-900/8 bg-background py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-8 space-y-2">
            <div className="font-mono text-xs uppercase tracking-wider text-meadow-700">
              Rychlý start
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink-900 md:text-4xl">
              Co dneska hledáš?
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <CategoryCard
              href="/adopt?species=dog"
              icon={<Dog className="size-7" />}
              label="Psi"
              tone="meadow"
            />
            <CategoryCard
              href="/adopt?species=cat"
              icon={<Cat className="size-7" />}
              label="Kočky"
              tone="sunshine"
            />
            <CategoryCard
              href="/adopt?urgent=1"
              icon={<Heart className="size-7" />}
              label="Naléhavé případy"
              badge={urgentCount ?? undefined}
              tone="peach"
            />
            <CategoryCard
              href="/adopt?long_stay=1"
              icon={<Home className="size-7" />}
              label="Dlouho čekají"
              badge={longStayCount ?? undefined}
              tone="sage"
            />
          </div>
        </div>
      </section>

      {/* FEATURED ANIMALS */}
      <section className="border-t border-ink-900/8 bg-cream-warm py-20">
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
            <div className="rounded-3xl bg-cream p-12 text-center text-ink-600">
              Zatím tu nejsou žádná zvířata. Brzy se to změní.
            </div>
          )}

          <div className="mt-10 flex justify-center">
            <ZozioButton asChild variant="outline" size="lg">
              <Link href="/adopt">Procházet všechny</Link>
            </ZozioButton>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="border-t border-ink-900/8 bg-background py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-12 space-y-2 text-center">
            <div className="font-mono text-xs uppercase tracking-wider text-meadow-700">
              Jak to funguje
            </div>
            <h2 className="font-display text-4xl font-bold tracking-tight text-ink-900 md:text-5xl">
              Od kliku k tlapce za 4 kroky
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <Step
              number="1"
              title="Najdi zvíře"
              text="Procházej katalog, filtruj podle plemene, povahy nebo lokace. Ulož si oblíbená."
              icon={<Search className="size-6" />}
            />
            <Step
              number="2"
              title="Pošli žádost"
              text="Vyplň krátký formulář o sobě. Útulek se ti ozve do několika dní."
              icon={<Heart className="size-6" />}
            />
            <Step
              number="3"
              title="Setkej se"
              text="Pozdrav svého potenciálního parťáka v útulku. Pokud to klikne, jdete dál."
              icon={<PawPrint className="size-6" />}
            />
            <Step
              number="4"
              title="Pojď domů"
              text="Podepiš adopční smlouvu a vezmi parťáka domů. Začíná nový život."
              icon={<Home className="size-6" />}
            />
          </div>
        </div>
      </section>

      {/* STORIES */}
      <section className="border-t border-ink-900/8 bg-meadow-100/40 py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="mb-12 space-y-2">
            <div className="font-mono text-xs uppercase tracking-wider text-meadow-700">
              Příběhy z nových domovů
            </div>
            <h2 className="font-display text-4xl font-bold tracking-tight text-ink-900 md:text-5xl">
              Adopce mění životy{" "}
              <span className="italic text-meadow-700">obou stran.</span>
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {STORIES.map((s) => (
              <StoryCard key={s.id} story={s} />
            ))}
          </div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="border-t border-ink-900/8 bg-ink-900 py-20 text-cream">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <Sparkles className="mx-auto mb-4 size-8 text-sunshine-400" />
          <h2 className="font-display text-4xl font-bold tracking-tight md:text-5xl">
            Buď u toho, když přijde{" "}
            <span className="italic text-sunshine-400">to pravé.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-cream/70 md:text-lg">
            Občasný newsletter s novými zvířaty, příběhy z útulků a pozváními
            na akce. Žádný spam.
          </p>
          <NewsletterForm className="mt-8" />
          <p className="mt-4 text-xs text-cream/50">
            Odhlásit se můžeš kdykoliv jedním klikem.
          </p>
        </div>
      </section>
    </>
  );
}

// ---- Subcomponents ------------------------------------------------------

function HeroBento({
  animalsAvailable,
  institutionsCount,
  urgentCount,
}: {
  animalsAvailable: number;
  institutionsCount: number;
  urgentCount: number;
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
          naléhá
        </div>
        <div className="mt-1 font-display text-4xl font-bold leading-none tracking-tight">
          {urgentCount}
        </div>
        <div className="mt-2 text-sm font-semibold">případů</div>
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

const TONE_CLASS = {
  meadow: "bg-meadow-500 text-cream hover:bg-meadow-600",
  sunshine: "bg-sunshine-400 text-ink-900 hover:bg-sunshine-500",
  peach: "bg-peach-200 text-terracotta-600 hover:bg-peach-300",
  sage: "bg-sage-100 text-sage-700 hover:bg-sage-100/80",
} as const;

function CategoryCard({
  href,
  icon,
  label,
  badge,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  badge?: number;
  tone: keyof typeof TONE_CLASS;
}) {
  return (
    <Link
      href={href}
      className={`group relative flex flex-col gap-4 rounded-3xl p-6 shadow-soft-sm ring-1 ring-ink-900/5 transition-all hover:-translate-y-1 hover:shadow-soft-md ${TONE_CLASS[tone]}`}
    >
      <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-cream/30 backdrop-blur">
        {icon}
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="font-display text-2xl font-bold leading-tight">
          {label}
        </span>
        {badge !== undefined && badge > 0 && (
          <span className="rounded-full bg-cream/30 px-2.5 py-1 text-xs font-bold backdrop-blur">
            {badge}
          </span>
        )}
      </div>
      <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
    </Link>
  );
}

function Step({
  number,
  title,
  text,
  icon,
}: {
  number: string;
  title: string;
  text: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="relative rounded-3xl bg-cream-warm p-6 ring-1 ring-ink-900/5">
      <div className="mb-5 flex items-center justify-between">
        <div className="inline-flex size-12 items-center justify-center rounded-2xl bg-meadow-500 text-cream">
          {icon}
        </div>
        <span className="font-display text-6xl font-bold leading-none tracking-tighter text-meadow-100">
          {number}
        </span>
      </div>
      <h3 className="font-display text-xl font-bold tracking-tight text-ink-900">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-600">{text}</p>
    </div>
  );
}

interface Story {
  id: string;
  petName: string;
  ownerName: string;
  location: string;
  quote: string;
  petPhoto: string;
}

const STORIES: Story[] = [
  {
    id: "1",
    petName: "Lola",
    ownerName: "Markéta & Tomáš",
    location: "Praha",
    quote:
      "Mysleli jsme, že adoptujeme my Lolu. Ukázalo se, že to bylo přesně naopak. Změnila nám život.",
    petPhoto:
      "https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=1200&q=80",
  },
  {
    id: "2",
    petName: "Albert",
    ownerName: "Eliška",
    location: "Brno",
    quote:
      "Z plachého kocoura ze stanice se za půl roku stal nejlepší parťák. Nelituji ani vteřiny.",
    petPhoto:
      "https://images.unsplash.com/photo-1573865526739-10659fec78a5?w=1200&q=80",
  },
  {
    id: "3",
    petName: "Bobeš",
    ownerName: "Rodina Veselých",
    location: "Olomouc",
    quote:
      "Hledali jsme psa pro děti. Bobeš nás přesvědčil, že už nikdy nechceme jiného než z útulku.",
    petPhoto:
      "https://images.unsplash.com/photo-1568572933382-74d440642117?w=1200&q=80",
  },
];

function StoryCard({ story }: { story: Story }) {
  return (
    <article className="overflow-hidden rounded-3xl bg-cream shadow-soft-sm ring-1 ring-ink-900/5">
      <div className="relative aspect-[4/3] bg-cream-warm">
        <Image
          src={story.petPhoto}
          alt={`${story.petName} v novém domově`}
          fill
          sizes="(min-width: 768px) 33vw, 100vw"
          className="object-cover"
        />
      </div>
      <div className="space-y-3 p-6">
        <p className="font-display text-lg italic leading-snug text-ink-900">
          „{story.quote}"
        </p>
        <div className="border-t border-ink-900/8 pt-3 text-sm">
          <div className="font-semibold text-ink-900">{story.ownerName}</div>
          <div className="text-ink-600">
            adoptovali {story.petName} · {story.location}
          </div>
        </div>
      </div>
    </article>
  );
}
